import Foundation
import Security

enum SecureStore {
  static let service = "app.telegate.credentials"
  #if targetEnvironment(simulator)
    // Simulator builds made without a signing team carry no Keychain entitlement, so every
    // SecItem call fails with errSecMissingEntitlement (-34018). Fall back to the simulator's
    // own defaults store so onboarding can be exercised there. Never compiled for devices.
    private static let fallbackPrefix = "simulator-secure-store."
    private static func fallbackSet(_ value: String, for key: String) {
      UserDefaults.standard.set(value, forKey: fallbackPrefix + key)
    }
    private static func fallbackGet(_ key: String) -> String? {
      UserDefaults.standard.string(forKey: fallbackPrefix + key)
    }
    private static func fallbackRemove(_ key: String) {
      UserDefaults.standard.removeObject(forKey: fallbackPrefix + key)
    }
  #endif
  static func set(_ value: String, for key: String) throws {
    let query: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service,
      kSecAttrAccount as String: key,
    ]
    let data = Data(value.utf8)
    var status = SecItemUpdate(
      query as CFDictionary, [kSecValueData as String: data] as CFDictionary)
    if status == errSecItemNotFound {
      var item = query
      item[kSecValueData as String] = data
      item[kSecAttrAccessible as String] = kSecAttrAccessibleWhenUnlockedThisDeviceOnly
      status = SecItemAdd(item as CFDictionary, nil)
    }
    #if targetEnvironment(simulator)
      if status == errSecMissingEntitlement {
        fallbackSet(value, for: key)
        return
      }
    #endif
    guard status == errSecSuccess else {
      throw UserFacingError(
        message:
          "Couldn’t save credentials in this device’s Keychain (error \(status)). Reinstall the app from Xcode with your Apple team selected under Signing & Capabilities."
      )
    }
  }
  static func get(_ key: String) -> String? {
    let q: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service,
      kSecAttrAccount as String: key, kSecReturnData as String: true,
      kSecMatchLimit as String: kSecMatchLimitOne,
    ]
    var result: CFTypeRef?
    guard SecItemCopyMatching(q as CFDictionary, &result) == errSecSuccess,
      let data = result as? Data
    else {
      #if targetEnvironment(simulator)
        return fallbackGet(key)
      #else
        return nil
      #endif
    }
    return String(data: data, encoding: .utf8)
  }
  static func remove(_ key: String) {
    SecItemDelete(
      [
        kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service,
        kSecAttrAccount as String: key,
      ] as CFDictionary)
    #if targetEnvironment(simulator)
      fallbackRemove(key)
    #endif
  }
}
