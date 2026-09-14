import Foundation

/// A spoken phrase that ends the call. Matching is deterministic and runs on the user's
/// live transcript, so it works even while the assistant is talking and never depends on
/// the model choosing to hang up.
///
/// GPT-Live delivers the user's transcript as fragments with no end-of-turn marker, so
/// `VoiceSession` gathers the current utterance and only evaluates it once it has settled
/// (no new fragment for a short moment). That keeps "add a button to end the call in
/// settings" from hanging up halfway through the sentence.
enum HangUpPhrase {
  static let defaultPhrase = "end call"
  static let storageKey = "hangUpPhrase"
  static let maxLength = 60
  /// Words that may surround the phrase without changing its meaning ("okay, end call please").
  private static let fillers: Set<String> = [
    "okay", "ok", "please", "now", "hey", "telegate", "alright", "and", "so", "thanks", "thank", "you", "bye",
  ]
  /// Articles that speech recognition adds or drops freely ("end the call" ≙ "end call").
  private static let articles: Set<String> = ["the", "a", "an", "this", "that"]
  /// A negation right before the phrase means the opposite ("don't end the call").
  private static let negations: Set<String> = ["dont", "not", "never", "no", "cant", "wont", "shouldnt", "didnt"]
  /// How many non-filler words may precede the phrase ("thanks, end call" yes; a whole sentence no).
  private static let maxLeadingWords = 2

  /// The saved phrase, or the default when nothing usable is saved.
  static var stored: String {
    let saved = normalize(UserDefaults.standard.string(forKey: storageKey) ?? "")
    return commandWords(saved).isEmpty ? defaultPhrase : saved
  }

  /// Lowercases, drops punctuation, and collapses whitespace so transcripts compare cleanly.
  static func normalize(_ text: String) -> String {
    let lowered = text.lowercased()
      .replacingOccurrences(of: "’", with: "'")
      .replacingOccurrences(of: "'", with: "")
    let scalars = lowered.unicodeScalars.map { scalar -> Character in
      CharacterSet.letters.contains(scalar) || CharacterSet.decimalDigits.contains(scalar)
        ? Character(scalar) : " "
    }
    return String(scalars).split(whereSeparator: { $0 == " " }).joined(separator: " ")
  }

  /// The words of a phrase that carry meaning: normalized, without articles.
  static func commandWords(_ phrase: String) -> [String] {
    normalize(phrase).split(separator: " ").map(String.init).filter { !articles.contains($0) }
  }

  /// True when the last sentence of a settled utterance is the phrase, with at most a couple
  /// of words around it.
  ///
  /// "end call", "Okay, end call.", "end the call please", "thanks, end call" and "…in the
  /// settings screen. End call." match; "don't end the call", "add a button to end the call in
  /// settings" and "I'll end call later" do not: the phrase must be (nearly) a whole sentence,
  /// and a negation right before it cancels it. Transcripts arrive punctuated, so a sentence
  /// break is the boundary; trailing sentences made only of fillers ("Bye.") are ignored.
  static func matches(utterance: String, phrase: String) -> Bool {
    let target = commandWords(phrase)
    guard !target.isEmpty else { return false }
    var sentences = utterance.split(whereSeparator: { ".?!\n".contains($0) }).map { commandWords(String($0)) }
      .filter { !$0.isEmpty }
    while let last = sentences.last, last.allSatisfy({ fillers.contains($0) }) { sentences.removeLast() }
    guard let spoken = sentences.last, spoken.count >= target.count else { return false }
    // "end call please" / "end call now": the phrase opens the utterance, followed only by fillers.
    if Array(spoken.prefix(target.count)) == target {
      return spoken.dropFirst(target.count).allSatisfy { fillers.contains($0) }
    }
    // "okay, end call" / "thanks, end call, bye": fillers may trail; a few words may lead.
    let trimmed = Array(spoken.reversed().drop(while: { fillers.contains($0) }).reversed())
    guard trimmed.count >= target.count, Array(trimmed.suffix(target.count)) == target else { return false }
    let leading = trimmed.dropLast(target.count)
    if let last = leading.last, negations.contains(last) { return false }
    return leading.filter { !fillers.contains($0) }.count <= maxLeadingWords
  }
}
