# Native bridge (Android / iOS apps, v3)

The apps load the web app build `web/dist-app` (`npm run build:web:app`: relative paths, hash routing) from local
files and run the Go engine (`server/mobile`, built with gomobile) next to the databases - tipitaka.app's design. The
JS ↔ native contract is one asynchronous call:

```
JS → native   Android: window.TipitakaNative.query(id, request)        (@JavascriptInterface)
              iOS:     window.webkit.messageHandlers.tipitaka.postMessage({ id, request })
native → JS   window.__tipitakaResolve(id, response)                    (on the UI thread)

request  = JSON {"query": "<named query>", ...params}   e.g. {"query":"text.entries","file":"dn-1","from":0,"to":1}
         | JSON {"op": "<operation>", ...params}         e.g. {"op":"lookup","w":"dhammaṃ"}
response = engine.Query(request): {"ok": <result>} or {"error": "<code>", "message": "..."}
```
The named queries are those of `server/engine/queries.sql` (the website: `GET /api/q/<name>`), the operations those of
`server/engine/call.go` (`GET /api/<op>`), with the same results (`web/src/data/source.ts` NativeSource, HttpSource).
Error codes: `bad_request`, `not_found`, `fts_syntax`, `timeout`, `too_broad`, `no_dict`, `internal`.
The operation `audio` (`{"op":"audio","f":"<label>.json"}`) fetches a timing file of the recitations: their CDN allows
only the website's origins (CORS), not `app://` or `file://` pages.

Optional native methods: `TipitakaNative.share(text)`, `TipitakaNative.setChromeColors(top, bottom)` (the status and
navigation bars take the theme's header and page colours).

## Android (`lk.tipitaka.main`, /Volumes/2TB/Android/Tipitaka.lk-v3)
A copy of tipitaka.app's v3 app: `MainActivity` (WebView on `file:///android_asset/dist-app/index.html`, external links
in the browser, back in the web app's history, app links of tipitaka.lk), `TipitakaBridge` (the engine on a pool of 3
threads), `DbInstaller` (text.db and dict.db copied from the install-time asset pack `server_data` to
`getDatabasePath()` on the first run and after an update; the databases of the apps before v3, `<n>@text.db`,
`<n>@dict.db`, `<n>@fts.db`, are deleted). `scripts/android-assets.sh` copies the web build, `engine.aar` and the dbs;
`./gradlew bundleRelease` there. minSdk 24 (Android 7); the AAR has arm64-v8a, armeabi-v7a and x86_64.

## iOS (`apple/iOS/App.swift`, bundle id `lk.tipitaka.ios`)
`scripts/build-apple.sh` builds `Engine.xcframework` (`MobileOpen(text, dict, &err)`, `engine.query(_:)`), the app web
build and the Xcode project (XcodeGen, `apple/project.yml`). A `WKWebView` loads `dist-app` from the bundle through a
`WKURLSchemeHandler` at `app://tipitaka/` (a real origin for localStorage and fonts); the `WKScriptMessageHandler` named
`tipitaka` runs `query` on a background queue and calls `window.__tipitakaResolve(id, response)` on the main queue. The
databases are in the bundle (`db/`). Media plays without a tap and in the background (the recitations). iOS 15+.
Debug builds take `-start <route> -theme <theme>` launch arguments (`xcrun simctl launch <device> lk.tipitaka.ios -start
/dn-1-1`), for screenshots.

The macOS App Store app is the Wails desktop app (`server/desktop.go`) in the same Xcode project and App Store record
(universal purchase): the Go universal binary replaces the placeholder executable of the `Tipitaka-macOS` target, so Xcode
signs, archives and uploads it. The Windows app is the same Wails app in an MSIX (`scripts/build-desktop.sh windows`).

## Apple's text engine
Safari, every iOS browser and app, and the Mac app shape text with CoreText. Abhaya Uni builds before 2026-10-26 lost the
second consonant of a bandi pair there when a vowel sign followed ("සමූහන්ති" read "සමූහන"); the fonts repo
(sinhala-unicode/build-2026, `safari_check.py`) now checks every touching pair with CoreText. The App Store builds 3.0
(2610261913) still have a canvas test that shows the Pali unjoined on Apple devices; later builds use the fixed font.

## Testing
`e2e/android.spec.ts` (`android-sim` project) runs the app build with a simulated bridge (asynchronous answers from the
test server's engine; the page never calls `/api`). `web/src/data/data.test.ts` covers out-of-order answers and errors;
`TestQueryJSON` (server) the engine's JSON entry point.
