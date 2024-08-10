import UIKit
import Capacitor

@UIApplicationMain
class AppDelegate: UIResponder, UIApplicationDelegate {
    var window: UIWindow?
    
    func application(_ application: UIApplication, didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?) -> Bool {
        // Override point for customization after application launch.
        
        // Listen for orientation changes
        NotificationCenter.default.addObserver(self, selector: #selector(didChangeOrientation), name: UIDevice.orientationDidChangeNotification, object: nil)
        
        // Ensure the window is set up
        if self.window == nil {
            self.window = UIWindow(frame: UIScreen.main.bounds)
        }
        
        self.window?.makeKeyAndVisible()
        return true
    }
    
    // Update constraints based on the current orientation
    private func updateConstraintsForCurrentOrientation(in rootViewController: UIViewController) {
        // Create a container view to hold the app's main content
        let containerView = UIView()
        containerView.translatesAutoresizingMaskIntoConstraints = false
        rootViewController.view.addSubview(containerView)

        let topAnchor: NSLayoutConstraint, leadingAnchor: NSLayoutConstraint, trailingAnchor: NSLayoutConstraint, bottomAnchor: NSLayoutConstraint

        if (isLandscape()) {
            topAnchor = containerView.topAnchor.constraint(equalTo: rootViewController.view.topAnchor);

            if (getNotchSideInLandscape() == "right") {
                leadingAnchor = containerView.leadingAnchor.constraint(equalTo: rootViewController.view.leadingAnchor)
                trailingAnchor = containerView.trailingAnchor.constraint(equalTo: rootViewController.view.safeAreaLayoutGuide.trailingAnchor)
            }
            else {
                leadingAnchor = containerView.leadingAnchor.constraint(equalTo: rootViewController.view.safeAreaLayoutGuide.leadingAnchor)
                trailingAnchor = containerView.trailingAnchor.constraint(equalTo: rootViewController.view.trailingAnchor)
            }
        }
        else {
            leadingAnchor = containerView.leadingAnchor.constraint(equalTo: rootViewController.view.leadingAnchor)
            trailingAnchor = containerView.trailingAnchor.constraint(equalTo: rootViewController.view.trailingAnchor)
            topAnchor = containerView.topAnchor.constraint(equalTo: rootViewController.view.safeAreaLayoutGuide.topAnchor)
        }
        
        bottomAnchor = containerView.bottomAnchor.constraint(equalTo: rootViewController.view.bottomAnchor)
        NSLayoutConstraint.activate([
            leadingAnchor,
            trailingAnchor,
            topAnchor,
            bottomAnchor])
        
        if let capacitorView = rootViewController.view.subviews.first {
            capacitorView.removeFromSuperview();
            containerView.addSubview(capacitorView)
            capacitorView.translatesAutoresizingMaskIntoConstraints = false
            NSLayoutConstraint.activate([
                capacitorView.leadingAnchor.constraint(equalTo: containerView.leadingAnchor),
                capacitorView.trailingAnchor.constraint(equalTo: containerView.trailingAnchor),
                capacitorView.topAnchor.constraint(equalTo: containerView.topAnchor),
                capacitorView.bottomAnchor.constraint(equalTo: containerView.bottomAnchor)
            ])
        }
    }
   
    
    // Handle orientation change
    @objc private func didChangeOrientation() {
        let rootViewController = getRootViewController();
        updateConstraintsForCurrentOrientation(in: rootViewController);
    }
    
    private func getRootViewController() -> UIViewController {
        // Get the current root view controller, or create a new one if none exists
        let rootViewController: UIViewController
        if let existingRootViewController = self.window?.rootViewController {
            rootViewController = existingRootViewController
        } else {
            rootViewController = CAPBridgeViewController()
            self.window?.rootViewController = rootViewController
        }
        return rootViewController;
    }
    
    func getNotchSideInLandscape() -> String? {
        guard let window = UIApplication.shared.windows.first else { return nil }
        
        let orientation = window.windowScene?.interfaceOrientation
        
        return orientation == .landscapeLeft ? "right" :
               orientation == .landscapeRight ? "left" : nil
    }
    
    // Helper method to check if the device is in landscape mode
    private func isLandscape() -> Bool {
        // Safely unwrap the first window
        guard let window = UIApplication.shared.windows.first,
              let windowScene = window.windowScene else {
            // If either the window or windowScene is nil, return false
            return false
        }
        
        // Safely access and return whether the interface orientation is landscape
        return windowScene.interfaceOrientation.isLandscape
    }

    deinit {
        NotificationCenter.default.removeObserver(self, name: UIDevice.orientationDidChangeNotification, object: nil)
    }
    
}
