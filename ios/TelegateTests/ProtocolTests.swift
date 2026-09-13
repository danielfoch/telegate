import XCTest

@testable import Telegate

final class ProtocolTests: XCTestCase {
  func testSignedBuildCanPersistCredentialsInKeychain() throws {
    let key = "readiness-test-\(UUID().uuidString)"
    defer { SecureStore.remove(key) }
    try SecureStore.set("disposable-test-value", for: key)
    XCTAssertEqual(SecureStore.get(key), "disposable-test-value")
    try SecureStore.set("updated-test-value", for: key)
    XCTAssertEqual(SecureStore.get(key), "updated-test-value")
  }
  func testBuildFlavorMatchesPushAvailability() {
    #if TELEGATE_DIY
      XCTAssertFalse(AppConfiguration.supportsPush)
      XCTAssertEqual(
        Bundle.main.object(forInfoDictionaryKey: "TelegatePushEnabled") as? String, "NO")
    #else
      XCTAssertTrue(AppConfiguration.supportsPush)
    #endif
  }

  func testTaskDecodesRelayContractIncludingNullThread() throws {
    let data = Data(
      """
      {"id":"job","deviceId":"mini","harnessId":"codex","title":"Fix mobile","prompt":"Do it","status":"queued","createdAt":123,"updatedAt":123,"result":"","runId":null,"threadURL":null,"leaseId":null}
      """.utf8)
    let task = try JSONDecoder().decode(DelegatedTask.self, from: data)
    XCTAssertEqual(task.deviceId, "mini")
    XCTAssertNil(task.threadURL)
  }
  func testBriefPersistsExactlyTheSameIdempotencyKey() throws {
    let brief = PendingBrief(
      id: "session:delegation:0", deviceId: "mini", harnessId: "codex", title: "Task",
      prompt: "Prompt", send: true)
    let restored = try JSONDecoder().decode(PendingBrief.self, from: JSONEncoder().encode(brief))
    XCTAssertEqual(restored.body["requestKey"] as? String, "session:delegation:0")
    XCTAssertEqual(restored.body["deviceId"] as? String, "mini")
  }
  func testVoiceContextByteBudgetPreservesUnicode() {
    let text = "ab🧑🏽‍💻你好é"
    for budget in 0...text.utf8.count {
      let bounded = text.utf8Prefix(budget)
      XCTAssertLessThanOrEqual(bounded.utf8.count, budget)
      XCTAssertTrue(text.unicodeScalars.starts(with: bounded.unicodeScalars))
    }
  }
  func testUntrustedServiceURLsAreRejected() {
    XCTAssertNotNil(AppConfiguration.validService("https://api.example.test"))
    XCTAssertNil(AppConfiguration.validService("http://api.example.test"))
    XCTAssertNil(AppConfiguration.validService("https://user:secret@api.example.test"))
    XCTAssertNil(AppConfiguration.validService("https://api.example.test?token=secret"))
  }
}
