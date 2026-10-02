# Native bridge contract (Android / iOS WebView apps)

The offline apps load the web app build `web/dist-app` (`npm run build:web:app`: relative paths, hash routing,
no ES modules) from local files and expose a JavaScript object `window.Android`. **This contract is unchanged
from v2** - an existing app only needs the new assets and databases.

## Files to bundle (`scripts/android-assets.sh`)
* web app: everything in `web/dist-app/` (index.html at the root of the asset folder)
* databases: `text.db` (replaces v2 `fts.db` **and** the `static/text/*.json` files) and `dict.db` (unchanged)

## window.Android
| method | behaviour |
|---|---|
| `runAsync(rand, funcName, jsonParams)` | run `funcName(JSON.parse(jsonParams))` on a background thread, store the result string, then evaluate `window[rand].callback(true)` (or `false` with an error string) on the UI thread |
| `runAsyncResult(rand)` | return (and forget) the stored result string |
| `getBjtParams()` | `"<folder url>|<ext>"` of locally stored BJT scans or `""` |

Async functions called through `runAsync`:
* `openDbs({ "text": <int version>, "dict": <int version> })` - copy `<type>.db` from the assets to
  `<version>@<type>.db` if missing (delete older versions), open read-only. The app calls this first and waits for it;
  `version` for text is `db_version` from `db/build-info.json` (yyMMddHH), dict stays 2.
* `runSqliteQuery({ "type": "text" | "dict", "sql": "<sql>" })` - run the SQL (params are already inlined) and return
  a JSON array of row objects (`[{"col": value, ...}]`). NULL/BLOB may be returned as `""` and integers as 32 bit ints -
  every query is written to return non-NULL int32 values. Errors should be reported via `callback(false)` with the
  exception text (`malformed MATCH` is shown as a search syntax error).

Required SQLite features (all in SQLite 3.9.2 = Android 7): FTS4 with `matchinfo`, recursive CTEs, `instr`, `char`, `hex`.
Enhanced FTS query syntax (parentheses) is not needed. The SQL comes only from `server/queries.sql`.

## Recommended app changes (v3)
* minimum OS: Android 7 (API 24) / iOS 12 (Vue 3 needs ES2015 Proxy).
* delete the obsolete `*@fts.db` copies (~476 MB) - see `WebAppInterface.deleteLegacyDbs()` in the Android app.
* static files are read with XMLHttpRequest relative to index.html (`static/data/*.json`).

## Testing
`e2e/android.spec.ts` runs the app build against a simulated bridge with the same quirks; `npm run test:sqlite-compat`
runs every query on SQLite 3.9.2. The app was also verified on an Android 7.0 emulator with its stock WebView 53.
