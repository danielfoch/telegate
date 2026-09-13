import Foundation

enum AppConfiguration {
  static var supportsPush: Bool {
    #if TELEGATE_DIY
      return false
    #else
      return Bundle.main.object(forInfoDictionaryKey: "TelegatePushEnabled") as? String == "YES"
    #endif
  }
  static let diyCompletionMessage =
    "Community DIY build: results appear in Tasks when you reopen or refresh the app. Background push alerts are not enabled in this build."
  static var service: String {
    if let saved = UserDefaults.standard.string(forKey: "serviceURL"), !saved.isEmpty {
      return saved
    }
    return Bundle.main.object(forInfoDictionaryKey: "TelegateServiceURL") as? String ?? ""
  }
  static func validService(_ value: String) -> URL? {
    guard let u = URL(string: value), let host = u.host, u.user == nil, u.password == nil,
      u.query == nil, u.fragment == nil, u.path.isEmpty || u.path == "/"
    else { return nil }
    if u.scheme == "https" { return u }
    #if DEBUG
      if u.scheme == "http" && ["127.0.0.1", "localhost", "::1"].contains(host) { return u }
    #endif
    return nil
  }
  /// Trims pasted whitespace and reduces a valid service address to its origin
  /// (`https://host[:port]`), so a trailing slash or stray newline never breaks a request.
  static func normalizedService(_ value: String) -> String? {
    let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
    guard let u = validService(trimmed), let scheme = u.scheme, let host = u.host else {
      return nil
    }
    return "\(scheme)://\(host)" + (u.port.map { ":\($0)" } ?? "")
  }
  static let serviceHint =
    "This is the HTTPS address of your Telegate relay. Telegate Connect on your Mac shows it under Settings; a self-hosted relay prints it at startup."
}
final class NoRedirect: NSObject, URLSessionTaskDelegate {
  func urlSession(
    _ session: URLSession, task: URLSessionTask,
    willPerformHTTPRedirection response: HTTPURLResponse, newRequest request: URLRequest,
    completionHandler: @escaping (URLRequest?) -> Void
  ) { completionHandler(nil) }
}
enum HTTP {
  // Redirects cannot forward BYOK or computer credentials to a different destination.
  static let session = URLSession(
    configuration: .ephemeral, delegate: NoRedirect(), delegateQueue: nil)
  static func json(_ url: URL, token: String?, body: [String: Any]? = nil) async throws -> Data {
    var r = URLRequest(url: url)
    r.timeoutInterval = 60
    r.httpMethod = body == nil ? "GET" : "POST"
    r.setValue("application/json", forHTTPHeaderField: "Content-Type")
    if let token { r.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
    if let body { r.httpBody = try JSONSerialization.data(withJSONObject: body) }
    let (data, response) = try await session.data(for: r)
    guard let h = response as? HTTPURLResponse, (200..<300).contains(h.statusCode) else {
      let e = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
      let msg =
        e?["error"] as? String ?? (e?["error"] as? [String: Any])?["message"] as? String
        ?? "The service could not complete this request."
      throw UserFacingError(message: String(msg.prefix(500)))
    }
    return data
  }
}
struct RelayAPI {
  var service: String
  var token: String?
  func request<T: Decodable>(_ path: String, body: [String: Any]? = nil) async throws -> T {
    guard let base = AppConfiguration.validService(service),
      let url = URL(string: path, relativeTo: base)
    else { throw UserFacingError(message: "Set the Telegate service address before connecting.") }
    let data: Data
    do {
      data = try await HTTP.json(url, token: token, body: body)
    } catch let error as URLError {
      let host = base.host ?? "your Telegate service"
      switch error.code {
      case .cannotConnectToHost, .cannotFindHost, .dnsLookupFailed, .timedOut:
        let hint = ["127.0.0.1", "localhost", "::1"].contains(host)
          ? "This is a local address. Start your relay and use its public HTTPS address on both your Mac and phone."
          : "Check that your relay is running and both devices use the same service address in Settings."
        throw UserFacingError(message: "Couldn’t reach \(host). \(hint)")
      case .notConnectedToInternet:
        throw UserFacingError(message: "You’re offline. Reconnect to the internet, then try again.")
      default: throw error
      }
    }
    return try JSONDecoder().decode(T.self, from: data)
  }
}
