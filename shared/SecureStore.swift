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
  static func get(_ key: String) -> String? { lookup(key).value }
  /// Reads a credential and reports why a read failed, so callers can tell a
  /// locked keychain or denied access apart from "never paired".
  static func lookup(_ key: String) -> (value: String?, status: OSStatus) {
    let q: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service,
      kSecAttrAccount as String: key, kSecReturnData as String: true,
      kSecMatchLimit as String: kSecMatchLimitOne,
    ]
    var result: CFTypeRef?
    let status = SecItemCopyMatching(q as CFDictionary, &result)
    guard status == errSecSuccess, let data = result as? Data else { return (nil, status) }
    return (String(data: data, encoding: .utf8), status)
  }
  static func describe(_ status: OSStatus) -> String {
    switch status {
    case errSecItemNotFound: return "the credential is missing from the keychain"
    case errSecInteractionNotAllowed: return "the login keychain is locked"
    case errSecAuthFailed: return "access to the keychain item was denied"
    case errSecUserCanceled: return "the keychain access request was cancelled"
    default:
      let text = SecCopyErrorMessageString(status, nil) as String? ?? "keychain error"
      return "\(text) (\(status))"
    }
  }
  static func remove(_ key: String) {
    SecItemDelete(
      [
        kSecClass as String: kSecClassGenericPassword, kSecAttrService as String: service,
        kSecAttrAccount as String: key,
      ] as CFDictionary)
  }
}
