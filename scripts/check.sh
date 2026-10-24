#!/usr/bin/env bash
# Everything that must pass before a commit (CI only validates the texts - .github/workflows/ci.yml):
# types, lint, unit tests, sqlite 3.9.2 (Android 7) compatibility, Go, the builds, old browser css, e2e in all browsers.
# Needs db/text.db and db/dict.db (npm run build:data, npm run build:dict) - the e2e fixture dictionary is cut from it.
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f db/dict.db ] || { echo "db/dict.db missing: npm run build:dict"; exit 1; }
step() { printf '\n\033[1;33m==> %s\033[0m\n' "$*"; }
step typecheck; npm run typecheck
step lint; npm run lint
step fixtures; npm run build:fixture
step "unit tests"; npm test
step "sqlite 3.9.2"; npm run test:sqlite-compat
step go; (cd server && go vet ./... && go test ./...)
step builds; npm run build:web && npm run build:web:app && npm run check:css && npm run build:server
# firefox: Playwright 1.63's Firefox 155 does not start on macOS 27 ("Could not find profile folder") - skipped with a
# warning until a Playwright release fixes it
PROJECTS=()
if ! node -e "import('@playwright/test').then(async ({ firefox }) => { await (await firefox.launch()).close() }).catch(() => process.exit(1))" 2>/dev/null; then
  echo "warning: firefox does not start here - the e2e tests run without it"
  PROJECTS=(--project desktop-chromium --project desktop-webkit --project mobile-chrome --project mobile-webkit --project android-sim)
fi
step "e2e (chromium, webkit, firefox, phones, android bridge)"; npx playwright test -c e2e/playwright.config.ts "${PROJECTS[@]}"
echo; echo "all checks passed"
