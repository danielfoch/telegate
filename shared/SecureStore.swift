import Foundation
import Security

enum SecureStore {
  static let service = "app.telegate.credentials"
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
    guard status == errSecSuccess else {
      if status == -34018 {
        throw UserFacingError(message: "This build is missing Keychain signing entitlements. Run a signed build from Xcode and reinstall Telegate; an unsigned build can compile but cannot save your account or voice key.")
      }
      throw UserFacingError(message: "Couldn’t save credentials in Keychain (\(status)).")
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
    else { return nil }
    return String(data: data, encoding: .utf8)
  }
  static func remove(_ key: String) {
    SecItemDelete(
      [
        kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service,
        kSecAttrAccount as String: key,
      ] as CFDictionary)
  }
}
