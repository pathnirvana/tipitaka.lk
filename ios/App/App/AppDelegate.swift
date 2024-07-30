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
        
        // Get the current root view controller
        if let rootViewController = self.window?.rootViewController {
            // Create a container view to hold the app's main content
            let containerView = UIView()
            containerView.translatesAutoresizingMaskIntoConstraints = false
            rootViewController.view.addSubview(containerView)
            
            // Adjust constraints to avoid the cutout area
            NSLayoutConstraint.activate([
                containerView.leadingAnchor.constraint(equalTo: rootViewController.view.leadingAnchor),
                containerView.trailingAnchor.constraint(equalTo: rootViewController.view.trailingAnchor),
                containerView.topAnchor.constraint(equalTo: rootViewController.view.safeAreaLayoutGuide.topAnchor),
                containerView.bottomAnchor.constraint(equalTo: rootViewController.view.safeAreaLayoutGuide.bottomAnchor)
            ])
            
            // Add the original root view controller's view to the container view
            if let originalView = rootViewController.view.subviews.first {
                containerView.addSubview(originalView)
                originalView.translatesAutoresizingMaskIntoConstraints = false
                NSLayoutConstraint.activate([
                    originalView.leadingAnchor.constraint(equalTo: containerView.leadingAnchor),
                    originalView.trailingAnchor.constraint(equalTo: containerView.trailingAnchor),
                    originalView.topAnchor.constraint(equalTo: containerView.topAnchor),
                    originalView.bottomAnchor.constraint(equalTo: containerView.bottomAnchor)
                ])
            }
        } else {
            // If there is no root view controller, set up a new one
            let rootViewController = UIViewController()
            self.window?.rootViewController = rootViewController
            
            // Create a container view to hold the app's main content
            let containerView = UIView()
            containerView.translatesAutoresizingMaskIntoConstraints = false
            rootViewController.view.addSubview(containerView)
            
            // Adjust constraints to avoid the cutout area
            NSLayoutConstraint.activate([
                containerView.leadingAnchor.constraint(equalTo: rootViewController.view.leadingAnchor),
                containerView.trailingAnchor.constraint(equalTo: rootViewController.view.trailingAnchor),
                containerView.topAnchor.constraint(equalTo: rootViewController.view.safeAreaLayoutGuide.topAnchor),
                containerView.bottomAnchor.constraint(equalTo: rootViewController.view.safeAreaLayoutGuide.bottomAnchor)
            ])
        }
        
        self.window?.makeKeyAndVisible()
        return true
    }
}
