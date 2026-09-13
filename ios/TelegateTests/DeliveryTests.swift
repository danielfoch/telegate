import XCTest
@testable import Telegate

private final class DeliveryProtocol: URLProtocol {
  static var handler: ((URLRequest) -> (Int, Data, TimeInterval))!
  override class func canInit(with request: URLRequest) -> Bool { true }
  override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
  override func startLoading() {
    let (status, data, delay) = Self.handler(request)
    DispatchQueue.global().asyncAfter(deadline: .now() + delay) { [self] in
      client?.urlProtocol(self, didReceive: HTTPURLResponse(url: request.url!, statusCode: status, httpVersion: nil, headerFields: ["Content-Type": "application/json"])!, cacheStoragePolicy: .notAllowed)
      client?.urlProtocol(self, didLoad: data)
      client?.urlProtocolDidFinishLoading(self)
    }
  }
  override func stopLoading() {}
}

final class DeliveryTests: XCTestCase {
  @MainActor func testConcurrentRetryWaitsForConfirmedDeliveryAndDoesNotDuplicate() async throws {
    let previous = HTTP.session
    let savedService = UserDefaults.standard.string(forKey: "serviceURL")
    UserDefaults.standard.set("https://relay.example.test", forKey: "serviceURL")
    let configuration = URLSessionConfiguration.ephemeral
    configuration.protocolClasses = [DeliveryProtocol.self]
    HTTP.session = URLSession(configuration: configuration)
    let model = AppModel(loadSavedState: false)
    let owner = UUID().uuidString
    model.login = Login(token: "fixture", userId: owner, username: "fixture")
    model.pending = [PendingBrief(id: "stable-operation", deviceId: "mini", harnessId: "codex", title: "Test", prompt: "Connection test", send: true)]
    let file = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!.appendingPathComponent("Telegate/\(owner)-outbox.json")
    defer {
      HTTP.session.invalidateAndCancel()
      HTTP.session = previous
      UserDefaults.standard.set(savedService, forKey: "serviceURL")
      try? FileManager.default.removeItem(at: file)
    }
    let lock = NSLock()
    var deliveries = 0
    DeliveryProtocol.handler = { request in
      if request.url!.path == "/v1/tasks" {
        lock.lock(); deliveries += 1; lock.unlock()
        return (200, Data("""
          {"task":{"id":"job","deviceId":"mini","harnessId":"codex","title":"Test","prompt":"Connection test","status":"queued","createdAt":1,"updatedAt":1,"result":""}}
          """.utf8), 0.25)
      }
      return (200, Data("{\"devices\":[],\"tasks\":[]}".utf8), 0)
    }
    let first = Task { try await model.flushPending() }
    try await Task.sleep(for: .milliseconds(50))
    try await model.flushPending()
    XCTAssertTrue(model.pending.isEmpty, "A concurrent Retry must not report success before the initial delivery finishes")
    try await first.value
    XCTAssertEqual(deliveries, 1)
    model.pending = [PendingBrief(id: "account-switch", deviceId: "mini", harnessId: "codex", title: "Test", prompt: "Connection test", send: true)]
    let switching = Task { try await model.flushPending() }
    try await Task.sleep(for: .milliseconds(50))
    model.login = nil
    model.pending = []
    do { try await switching.value; XCTFail("An old account delivery must not mutate the new account's outbox") }
    catch { XCTAssertTrue(error.localizedDescription.contains("account or service changed")) }
  }

  @MainActor func testFailedDeliveryRetainsExactOperationForRetry() async throws {
    let previous = HTTP.session
    let savedService = UserDefaults.standard.string(forKey: "serviceURL")
    UserDefaults.standard.set("https://relay.example.test", forKey: "serviceURL")
    let configuration = URLSessionConfiguration.ephemeral
    configuration.protocolClasses = [DeliveryProtocol.self]
    HTTP.session = URLSession(configuration: configuration)
    defer {
      HTTP.session.invalidateAndCancel(); HTTP.session = previous
      UserDefaults.standard.set(savedService, forKey: "serviceURL")
    }
    DeliveryProtocol.handler = { _ in (503, Data("{\"error\":\"Service unavailable\"}".utf8), 0) }
    let model = AppModel(loadSavedState: false)
    model.login = Login(token: "fixture", userId: UUID().uuidString, username: "fixture")
    model.pending = [PendingBrief(id: "keep-this-id", deviceId: "mini", harnessId: "codex", title: "Test", prompt: "Connection test", send: true)]
    do { try await model.flushPending(); XCTFail("Expected delivery failure") }
    catch { XCTAssertEqual(model.pending.first?.id, "keep-this-id") }
    XCTAssertEqual(model.pending.count, 1)
  }
}
