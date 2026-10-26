// iOS app (tipitaka.app's App.swift): the app build of the web UI (web/dist-app) in a WKWebView, the Go engine
// (Engine.xcframework, server/mobile) next to the databases in the bundle. The JS ↔ native contract is in
// dev-docs/native-bridge.md. The recitations play without a tap (they start once their timings are loaded) and go on
// in the background (audio session: playback).
import AVFoundation
import UIKit
import WebKit
import Engine

@main
final class AppDelegate: UIResponder, UIApplicationDelegate {
    func application(_ application: UIApplication, didFinishLaunchingWithOptions options: [UIApplication.LaunchOptionsKey: Any]? = nil) -> Bool {
        try? AVAudioSession.sharedInstance().setCategory(.playback, mode: .spokenAudio)
        return true
    }

    func application(_ application: UIApplication, configurationForConnecting session: UISceneSession,
                     options: UIScene.ConnectionOptions) -> UISceneConfiguration {
        UISceneConfiguration(name: "Default", sessionRole: session.role)
    }
}

final class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options: UIScene.ConnectionOptions) {
        guard let scene = scene as? UIWindowScene else { return }
        let window = UIWindow(windowScene: scene)
        window.rootViewController = WebViewController()
        window.makeKeyAndVisible()
        self.window = window
    }
}

final class WebViewController: UIViewController, WKNavigationDelegate, WKUIDelegate {
    private var webView: WKWebView!
    private let topBar = UIView() // behind the status bar: the colour of the app's header
    private var lightContent = false

    override func loadView() {
        let root = Bundle.main.resourceURL!.appendingPathComponent("dist-app")
        let config = WKWebViewConfiguration()
        config.mediaTypesRequiringUserActionForPlayback = []
        config.allowsInlineMediaPlayback = true
        config.setURLSchemeHandler(BundleSchemeHandler(root: root), forURLScheme: "app")
        let bridge = Bridge()
        config.userContentController.add(bridge, name: "tipitaka")
        config.userContentController.add(ChromeColors { [weak self] top, bottom in self?.setColors(top: top, bottom: bottom) },
                                         name: "chrome")
        config.userContentController.addUserScript(WKUserScript(source: ChromeColors.script, injectionTime: .atDocumentEnd,
                                                                forMainFrameOnly: true))
        webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = self
        webView.uiDelegate = self
        webView.allowsBackForwardNavigationGestures = true
        webView.scrollView.contentInsetAdjustmentBehavior = .never // the web view is inside the safe area
        bridge.webView = webView

        let view = UIView()
        view.backgroundColor = UIColor(red: 0.984, green: 0.973, blue: 0.953, alpha: 1) // --c-bg until the page reports
        topBar.backgroundColor = .white
        for v in [topBar, webView!] { v.translatesAutoresizingMaskIntoConstraints = false; view.addSubview(v) }
        let safe = view.safeAreaLayoutGuide
        NSLayoutConstraint.activate([
            topBar.topAnchor.constraint(equalTo: view.topAnchor), topBar.bottomAnchor.constraint(equalTo: safe.topAnchor),
            topBar.leadingAnchor.constraint(equalTo: view.leadingAnchor), topBar.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            webView.topAnchor.constraint(equalTo: safe.topAnchor), webView.bottomAnchor.constraint(equalTo: safe.bottomAnchor),
            webView.leadingAnchor.constraint(equalTo: safe.leadingAnchor), webView.trailingAnchor.constraint(equalTo: safe.trailingAnchor),
        ])
        self.view = view
        var start = "app://tipitaka/index.html"
        #if DEBUG // screenshots: simctl launch … -start /dn-1-1 [-theme sepia|dark]
        if let route = UserDefaults.standard.string(forKey: "start") { start += "#" + route }
        if let theme = UserDefaults.standard.string(forKey: "theme") {
            let js = "localStorage.setItem('tipitaka.lk-settings-2', JSON.stringify(Object.assign(JSON.parse(localStorage.getItem('tipitaka.lk-settings-2') || '{}'), { theme: '\(theme)' })))"
            config.userContentController.addUserScript(WKUserScript(source: js, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        }
        #endif
        webView.load(URLRequest(url: URL(string: start)!))
    }

    override var preferredStatusBarStyle: UIStatusBarStyle { lightContent ? .lightContent : .darkContent }

    private func setColors(top: UIColor, bottom: UIColor) {
        topBar.backgroundColor = top
        view.backgroundColor = bottom
        webView.isOpaque = false
        webView.backgroundColor = bottom
        var white: CGFloat = 0
        top.getWhite(&white, alpha: nil)
        lightContent = white < 0.5
        setNeedsStatusBarAppearanceUpdate()
    }

    // links to other sites open in Safari
    func webView(_ webView: WKWebView, decidePolicyFor action: WKNavigationAction,
                 decisionHandler: @escaping (WKNavigationActionPolicy) -> Void) {
        guard let url = action.request.url, url.scheme != "app", url.scheme != "about" else { return decisionHandler(.allow) }
        if ["http", "https", "mailto"].contains(url.scheme ?? "") { UIApplication.shared.open(url) }
        decisionHandler(.cancel)
    }

    func webView(_ webView: WKWebView, createWebViewWith configuration: WKWebViewConfiguration,
                 for action: WKNavigationAction, windowFeatures: WKWindowFeatures) -> WKWebView? {
        if let url = action.request.url, ["http", "https", "mailto"].contains(url.scheme ?? "") { UIApplication.shared.open(url) }
        return nil
    }

    // the web content process can be ended by the system (memory): reload instead of a blank page
    func webViewWebContentProcessDidTerminate(_ webView: WKWebView) { webView.reload() }
}

/// window.webkit.messageHandlers.tipitaka.postMessage({id, request}) → engine.query on a background queue →
/// window.__tipitakaResolve(id, response)
final class Bridge: NSObject, WKScriptMessageHandler {
    weak var webView: WKWebView?
    private let queue = DispatchQueue(label: "lk.tipitaka.engine", qos: .userInitiated, attributes: .concurrent)
    private let engine: MobileEngine?
    private let openError: String

    override init() {
        var error: NSError?
        let db = Bundle.main.resourceURL!.appendingPathComponent("db")
        engine = MobileOpen(db.appendingPathComponent("text.db").path, db.appendingPathComponent("dict.db").path, &error)
        openError = error?.localizedDescription ?? "the databases could not be opened"
        super.init()
    }

    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let body = message.body as? [String: Any], let id = body["id"] as? String,
              let request = body["request"] as? String else { return }
        queue.async { [weak self] in
            guard let self else { return }
            let response = self.engine?.query(request) ?? "{\"error\":\"internal\",\"message\":\(jsString(self.openError))}"
            let js = "window.__tipitakaResolve(\(jsString(id)),\(jsString(response)))"
            DispatchQueue.main.async { self.webView?.evaluateJavaScript(js) }
        }
    }
}

/// the header and page colours of the current theme, so the status bar area matches the app
final class ChromeColors: NSObject, WKScriptMessageHandler {
    static let script = """
    (function () {
      function send() {
        var h = document.querySelector('header'), b = getComputedStyle(document.body).backgroundColor
        window.webkit.messageHandlers.chrome.postMessage([h ? getComputedStyle(h).backgroundColor : b, b])
      }
      new MutationObserver(send).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
      setTimeout(send, 50); setTimeout(send, 1000)
    })()
    """
    private let onChange: (UIColor, UIColor) -> Void
    init(_ onChange: @escaping (UIColor, UIColor) -> Void) { self.onChange = onChange }

    func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
        guard let pair = message.body as? [String], pair.count == 2, let top = cssColor(pair[0]), let bottom = cssColor(pair[1]) else { return }
        onChange(top, bottom)
    }

    /// "rgb(251, 248, 243)" / "rgba(…)"
    private func cssColor(_ s: String) -> UIColor? {
        let n = s.split(whereSeparator: { !"0123456789.".contains($0) }).compactMap { Double($0) }
        guard n.count >= 3 else { return nil }
        return UIColor(red: n[0] / 255, green: n[1] / 255, blue: n[2] / 255, alpha: 1)
    }
}

/// serves the bundled web build at app://tipitaka/… (a real origin: localStorage, fonts and scripts work as on the site)
final class BundleSchemeHandler: NSObject, WKURLSchemeHandler {
    private let root: URL
    init(root: URL) { self.root = root.standardizedFileURL }

    func webView(_ webView: WKWebView, start task: WKURLSchemeTask) {
        guard let url = task.request.url else { return }
        let path = url.path.isEmpty || url.path == "/" ? "index.html" : String(url.path.dropFirst())
        let file = root.appendingPathComponent(path).standardizedFileURL
        guard file.path.hasPrefix(root.path + "/"), let data = try? Data(contentsOf: file) else {
            task.didReceive(HTTPURLResponse(url: url, statusCode: 404, httpVersion: "HTTP/1.1", headerFields: nil)!)
            task.didFinish()
            return
        }
        let headers = ["Content-Type": mimeType(file.pathExtension), "Content-Length": String(data.count)]
        task.didReceive(HTTPURLResponse(url: url, statusCode: 200, httpVersion: "HTTP/1.1", headerFields: headers)!)
        task.didReceive(data)
        task.didFinish()
    }

    func webView(_ webView: WKWebView, stop task: WKURLSchemeTask) {}

    private func mimeType(_ ext: String) -> String {
        switch ext.lowercased() {
        case "html": return "text/html; charset=utf-8"
        case "js": return "text/javascript; charset=utf-8"
        case "css": return "text/css; charset=utf-8"
        case "json", "webmanifest": return "application/json"
        case "svg": return "image/svg+xml"
        case "png": return "image/png"
        case "jpg", "jpeg": return "image/jpeg"
        case "ico": return "image/x-icon"
        case "woff2": return "font/woff2"
        case "woff": return "font/woff"
        case "ttf": return "font/ttf"
        default: return "application/octet-stream"
        }
    }
}

/// a JavaScript string literal
func jsString(_ s: String) -> String {
    guard let data = try? JSONEncoder().encode(s), let literal = String(data: data, encoding: .utf8) else { return "\"\"" }
    return literal
}
