#!/usr/bin/env bash
# Tests the Microsoft Store packages on a GitHub Actions Windows runner (.github/workflows/windows.yml): uploads the
# msix files (default: the newest release/tipitaka_lk-*.msix and release/pitaka_lk-*.msix of scripts/build-desktop.sh)
# to the draft release windows-test (a draft is not public), runs the workflow and downloads its screenshots to
# release/windows-test/.
#   scripts/test-windows.sh [release/pitaka_lk-3.0.0.msix ...]
set -euo pipefail
cd "$(dirname "$0")/.."
TAG=windows-test
files=("$@")
if [ ${#files[@]} = 0 ]; then
  for exe in tipitaka_lk pitaka_lk; do
    f=$(ls -t release/$exe-*.msix 2>/dev/null | head -1 || true)
    [ -n "$f" ] && files+=("$f")
  done
fi
[ ${#files[@]} -gt 0 ] || { echo "no msix: scripts/build-desktop.sh windows [--flavor pitaka]"; exit 1; }
gh release view $TAG >/dev/null 2>&1 ||
  gh release create $TAG --draft --title "Windows test packages" --notes "The msix files of .github/workflows/windows.yml, not a release."
# one package per app: the older versions go
assets=$(gh release view $TAG --json assets -q '.assets[].name')
for f in "${files[@]}"; do
  exe=$(basename "$f" | sed -E 's/-[0-9.]+\.msix$//')
  for a in $(grep "^$exe-" <<<"$assets" || true); do gh release delete-asset $TAG "$a" -y; done
done
gh release upload $TAG "${files[@]}" --clobber

last=$(gh run list -w windows.yml -L1 --json databaseId -q '.[0].databaseId // 0')
gh workflow run windows.yml -f tag=$TAG
while id=$(gh run list -w windows.yml -L1 --json databaseId -q '.[0].databaseId // 0'); [ "$id" = "$last" ]; do sleep 3; done
status=0
gh run watch "$id" --exit-status || status=$?
rm -rf release/windows-test
gh run download "$id" -D release/windows-test || true
gh run view "$id" --log | grep -E '(ok  |FAIL) |console errors' || true
ls release/windows-test/*/ 2>/dev/null || true
exit $status
