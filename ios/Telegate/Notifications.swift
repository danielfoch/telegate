import UIKit
import UserNotifications

struct PushConfiguration: Decodable { var ready: Bool }
final class TelegateAppDelegate: NSObject, UIApplicationDelegate, UNUserNotificationCenterDelegate {
  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    UNUserNotificationCenter.current().delegate = self
    if AppConfiguration.supportsPush
      && UserDefaults.standard.bool(forKey: "completionNotifications")
    {
      application.registerForRemoteNotifications()
    }
    return true
  }
  func application(
    _ application: UIApplication, didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
  ) {
    let token = deviceToken.map { String(format: "%02x", $0) }.joined()
    Task { @MainActor in await AppModel.shared.registerPush(token) }
  }
  func application(
    _ application: UIApplication, didFailToRegisterForRemoteNotificationsWithError error: Error
  ) {
    Task { @MainActor in
      AppModel.shared.notificationStatus =
        "Push registration failed. A signed build with push capability is required. \(error.localizedDescription)"
    }
  }
  func userNotificationCenter(
    _ center: UNUserNotificationCenter, didReceive response: UNNotificationResponse,
    withCompletionHandler completionHandler: @escaping () -> Void
  ) {
    if let task = response.notification.request.content.userInfo["taskId"] as? String {
      Task { @MainActor in await AppModel.shared.openNotificationTask(task) }
    }
    completionHandler()
  }
  func userNotificationCenter(
    _ center: UNUserNotificationCenter, willPresent notification: UNNotification,
    withCompletionHandler completionHandler: @escaping (UNNotificationPresentationOptions) -> Void
  ) { completionHandler([.banner, .list, .sound]) }
}
