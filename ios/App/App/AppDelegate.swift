import UIKit
import Capacitor

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {
    
    var window: UIWindow?

    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Override point for customization after application launch.
        
        // Ensure the window is set up
        if self.window == nil {
            self.window = UIWindow(frame: UIScreen.main.bounds)
        }
        
        // Get the current root view controller, or create a new one if none exists
        let rootViewController: UIViewController
        if let existingRootViewController = self.window?.rootViewController {
            rootViewController = existingRootViewController
        } else {
            rootViewController = CAPBridgeViewController()
            self.window?.rootViewController = rootViewController
        }
        
        // Create a container view to hold the app's main content
        let containerView = UIView()
        containerView.translatesAutoresizingMaskIntoConstraints = false
        rootViewController.view.addSubview(containerView)
        
        // Adjust constraints to avoid the cutout area at the top
        NSLayoutConstraint.activate([
            containerView.leadingAnchor.constraint(equalTo: rootViewController.view.leadingAnchor),
            containerView.trailingAnchor.constraint(equalTo: rootViewController.view.trailingAnchor),
            containerView.topAnchor.constraint(equalTo: rootViewController.view.safeAreaLayoutGuide.topAnchor),
            containerView.bottomAnchor.constraint(equalTo: rootViewController.view.bottomAnchor)
        ])
        
        if let capacitorView = rootViewController.view.subviews.first {
            containerView.addSubview(capacitorView)
            capacitorView.translatesAutoresizingMaskIntoConstraints = false
            NSLayoutConstraint.activate([
                capacitorView.leadingAnchor.constraint(equalTo: containerView.leadingAnchor),
                capacitorView.trailingAnchor.constraint(equalTo: containerView.trailingAnchor),
                capacitorView.topAnchor.constraint(equalTo: containerView.topAnchor),
                capacitorView.bottomAnchor.constraint(equalTo: containerView.bottomAnchor)
            ])
        }
        
        self.window?.makeKeyAndVisible()
        return true
    }
}
