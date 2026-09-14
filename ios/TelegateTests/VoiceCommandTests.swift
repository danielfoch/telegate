import XCTest

@testable import Telegate

final class VoiceCommandTests: XCTestCase {
  func testNormalizeDropsPunctuationCaseAndExtraSpaces() {
    XCTAssertEqual(HangUpPhrase.normalize("  End   Call!  "), "end call")
    XCTAssertEqual(HangUpPhrase.normalize("Don’t end—call."), "dont end call")
    XCTAssertEqual(HangUpPhrase.normalize(""), "")
  }

  func testDefaultPhraseMatchesNaturalVariants() {
    for spoken in [
      "end call", "End call.", "Okay, end call", "end call please", "end the call",
      "End the call now.", "Thanks, end call.", "alright end call okay", "yeah okay end the call now", "Telegate, end call. Bye.",
      "Add a button to end the call in the settings screen. End call.", "Okay. End call!", "That's all for now. End call, thanks.",
    ] {
      XCTAssertTrue(HangUpPhrase.matches(utterance: spoken, phrase: "end call"), spoken)
    }
  }

  func testDefaultPhraseIgnoresMentionsThatAreNotCommands() {
    for spoken in [
      "don't end call yet", "I'll end call later", "call", "end", "", "end the call for the meeting tomorrow",
      "the call ended badly", "don't end the call", "Do not end the call.", "please don't end call",
      "never end the call", "Add a button to end the call in the settings screen",
      "can you add a button to end the call", "Make the header blue, then end call", "End call. Actually wait.", "Bye.", "Don't end the call. Yet.",
    ] {
      XCTAssertFalse(HangUpPhrase.matches(utterance: spoken, phrase: "end call"), spoken)
    }
  }

  func testCustomPhraseAndEmptyPhrase() {
    XCTAssertTrue(HangUpPhrase.matches(utterance: "okay hang up now", phrase: "Hang up"))
    XCTAssertFalse(HangUpPhrase.matches(utterance: "end call", phrase: "hang up"))
    XCTAssertFalse(HangUpPhrase.matches(utterance: "anything", phrase: "   "))
    XCTAssertFalse(HangUpPhrase.matches(utterance: "the", phrase: "the"))
  }

  func testStoredPhraseFallsBackToDefault() {
    let defaults = UserDefaults.standard
    let previous = defaults.string(forKey: HangUpPhrase.storageKey)
    defer { defaults.set(previous, forKey: HangUpPhrase.storageKey) }
    defaults.set("  ", forKey: HangUpPhrase.storageKey)
    XCTAssertEqual(HangUpPhrase.stored, HangUpPhrase.defaultPhrase)
    defaults.set("the a that", forKey: HangUpPhrase.storageKey)
    XCTAssertEqual(HangUpPhrase.stored, HangUpPhrase.defaultPhrase)
    defaults.set("Hang Up.", forKey: HangUpPhrase.storageKey)
    XCTAssertEqual(HangUpPhrase.stored, "hang up")
  }

  @MainActor func testSettledUserUtteranceEndsTheCall() {
    let voice = VoiceSession()
    voice.hangUpPhrase = "end call"
    voice.state = .live
    // The assistant saying the exact phrase must never hang up.
    voice.ingestTranscript(role: "assistant", delta: "Okay, end call")
    voice.settleHangUpCheck()
    XCTAssertFalse(voice.endedByVoice)
    XCTAssertEqual(voice.state, .live)
    // Fragments arrive in pieces, interleaved with the assistant; the buffer spans them.
    voice.ingestTranscript(role: "user", delta: "Okay, end")
    voice.ingestTranscript(role: "assistant", delta: " Sure.")
    voice.ingestTranscript(role: "user", delta: " call")
    XCTAssertFalse(voice.endedByVoice, "nothing decides before the utterance settles")
    voice.settleHangUpCheck()
    XCTAssertTrue(voice.endedByVoice)
    XCTAssertEqual(voice.state, .ending)
  }

  @MainActor func testSentenceThatMerelyContainsThePhraseDoesNotHangUp() async throws {
    let voice = VoiceSession()
    voice.hangUpPhrase = "end call"
    voice.hangUpSettle = .milliseconds(120)
    voice.state = .live
    voice.ingestTranscript(role: "user", delta: "Add a button")
    voice.ingestTranscript(role: "user", delta: " to end the call")
    try await Task.sleep(for: .milliseconds(40))
    voice.ingestTranscript(role: "user", delta: " in the settings screen.")
    try await Task.sleep(for: .milliseconds(300))
    XCTAssertFalse(voice.endedByVoice)
    XCTAssertEqual(voice.state, .live)
    // Said as its own sentence right after, it hangs up once the utterance settles.
    voice.ingestTranscript(role: "user", delta: " End call.")
    voice.settleHangUpCheck()
    XCTAssertTrue(voice.endedByVoice)
  }

  @MainActor func testPhraseBeforeTheCallIsLiveDoesNothing() {
    let voice = VoiceSession()
    voice.hangUpPhrase = "end call"
    voice.ingestTranscript(role: "user", delta: "end call")
    voice.settleHangUpCheck()
    XCTAssertFalse(voice.endedByVoice)
    XCTAssertEqual(voice.state, .idle)
  }
}
