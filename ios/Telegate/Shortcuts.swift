import AppIntents

struct StartVoiceChat: AppIntent {
  static var title: LocalizedStringResource = "Start voice chat"
  static var description = IntentDescription(
    "Open Telegate and start talking to your agents on your selected computer.")
  static var openAppWhenRun: Bool = true
  // Foreground-only: the app checks setup and requests microphone permission before capture.
  @MainActor func perform() async throws -> some IntentResult {
    AppModel.shared.requestShortcut()
    return .result()
  }
}
struct TelegateShortcuts: AppShortcutsProvider {
  static var appShortcuts: [AppShortcut] {
    AppShortcut(
      intent: StartVoiceChat(),
      phrases: ["Start a call with \(.applicationName)", "Delegate with \(.applicationName)"],
      shortTitle: "Start voice chat", systemImageName: "phone.fill")
  }
}
