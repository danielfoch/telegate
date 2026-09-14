import AppKit
import CryptoKit
import ServiceManagement
import SwiftUI

enum ExecutableLocator {
  static func find(_ name: String) -> String {
    let home = FileManager.default.homeDirectoryForCurrentUser.path
    var paths = [
      "/opt/homebrew/bin/\(name)", "/usr/local/bin/\(name)", "\(home)/.local/bin/\(name)",
    ]
    if name == "codex" {
      paths += [
        "\(home)/.codex/plugins/.plugin-appserver/codex",
        "/Applications/Codex.app/Contents/Resources/codex",
      ]
    }
    return paths.first { FileManager.default.isExecutableFile(atPath: $0) } ?? name
  }
}

struct LocalHarness: Codable, Identifiable {
  var id = UUID().uuidString
  var name = "Codex"
  var kind = "codex"
  var enabled = true
  var command = ExecutableLocator.find("codex")
  var cwd = FileManager.default.homeDirectoryForCurrentUser.path
  var args: [String] = []
  var url = ""
  var token = ""
  var shareProjectContext = false
  var timeoutMinutes = 240
  var agentId: String?
  // How Codex / Claude Code handle approvals when they run unattended: auto, edits, or bypass.
  var approvalMode = "auto"
  var summary: Harness { Harness(id: id, name: name, kind: kind, enabled: enabled) }
  init() {}
  private enum CodingKeys: String, CodingKey {
    case id, name, kind, enabled, command, cwd, args, url, token, shareProjectContext,
      timeoutMinutes, agentId, approvalMode
  }
  init(from decoder: Decoder) throws {
    let values = try decoder.container(keyedBy: CodingKeys.self)
    id = try values.decode(String.self, forKey: .id)
    name = try values.decode(String.self, forKey: .name)
    kind = try values.decode(String.self, forKey: .kind)
    enabled = try values.decode(Bool.self, forKey: .enabled)
    command = try values.decode(String.self, forKey: .command)
    cwd = try values.decode(String.self, forKey: .cwd)
    args = try values.decode([String].self, forKey: .args)
    url = try values.decode(String.self, forKey: .url)
    token = try values.decode(String.self, forKey: .token)
    shareProjectContext = try values.decode(Bool.self, forKey: .shareProjectContext)
    // Early Connect builds did not write these fields. Preserve their saved agents.
    timeoutMinutes = try values.decodeIfPresent(Int.self, forKey: .timeoutMinutes) ?? 240
    agentId = try values.decodeIfPresent(String.self, forKey: .agentId)
    approvalMode = try values.decodeIfPresent(String.self, forKey: .approvalMode) ?? "auto"
  }
}
struct ComputerConfiguration: Codable {
  var service: String
  var name: String
  var deviceId: String?
  /// Device token for this pairing. Kept in this private (0600) file, like the CLI
  /// companion's config; revoke the computer from the phone to invalidate it.
  var deviceToken: String?
  var harnesses: [LocalHarness]
}
@MainActor final class ConnectModel: ObservableObject {
  @Published var service = AppConfiguration.service
  @Published var name = Host.current().localizedName ?? "My Mac"
  @Published var harnesses: [LocalHarness] = [LocalHarness()]
  @Published var pair: Pairing?
  @Published var deviceId: String?
  @Published var connected = false
  @Published var busy = false
  @Published var error: String?
  /// Set when the config says this Mac is paired but no usable device token is stored.
  @Published var credentialProblem: String?
  private var deviceToken: String?
  private var pendingSecret: String?
  @Published var log = ""
  @Published var node = "/opt/homebrew/bin/node"
  @Published var launchAtLogin = SMAppService.mainApp.status == .enabled
  @Published var checking = false
  @Published var checkedHarnesses: [Harness] = []
  @Published var checkMessage: String?
  @Published var relay: RelayHealth = .unknown
  @Published var restarting = false
  @Published var stopping = false
  @Published var stopTimedOut = false
  private var process: Process?
  private var afterExit: (() -> Void)?
  private var userInitiatedStop = false
  private var stopWatchdog: Task<Void, Never>?
  var hasProcess: Bool { process != nil }

  enum RelayHealth: Equatable {
    case unknown, checking, ok, unreachable(String)
  }
  enum AgentStatus: Equatable {
    case off, unchecked, ready, problem(String)
  }
  /// What the last "Check setup" said about an agent, if anything.
  func status(for harness: LocalHarness) -> AgentStatus {
    if !harness.enabled { return .off }
    guard let checked = checkedHarnesses.first(where: { $0.id == harness.id }) else { return .unchecked }
    if let problem = checked.problem { return .problem(problem) }
    return .ready
  }
  /// GET /health on the configured relay; never throws, updates `relay`.
  func checkRelay() async {
    guard AppConfiguration.validService(service) != nil else { relay = .unreachable("No service address set."); return }
    relay = .checking
    struct Health: Decodable { var status: String }
    do {
      let health: Health = try await RelayAPI(service: service).request("/health")
      relay = health.status == "ok" ? .ok : .unreachable("The service did not report healthy.")
    } catch { relay = .unreachable(error.localizedDescription) }
  }
  /// Apply saved settings to a running connector without making the user pause first.
  /// Does nothing while paused: saving never resumes on its own.
  func restart() {
    // A stop already in flight (Pause, Unpair, Re-pair, Quit) wins; start() re-reads the saved config.
    guard process != nil, !stopping else { return }
    restarting = true
    log += "Applying changes; restarting connector.\n"
    afterExit = { [weak self] in
      self?.restarting = false
      self?.start()
    }
    stop()
  }
  /// Stop, then forget the pairing (from the termination hook when a process is running).
  func unpair() {
    if process != nil {
      restarting = false  // an unpair takes over any pending restart
      afterExit = { [weak self] in self?.resetPairing() }
      stop()
    } else {
      resetPairing()
    }
  }
  func forceStop() {
    guard let process, process.isRunning else { return }
    kill(process.processIdentifier, SIGKILL)
    log += "Connector did not stop; forced.\n"
  }
  /// Stop for quit: drop any pending restart/re-pair hook so nothing relaunches.
  func stopForQuit() {
    afterExit = nil
    restarting = false
    stop()
  }
  private var pairingWork: Task<Void, Never>?
  private var isPreviewCapture: Bool {
    #if DEBUG
      return DesignPreviewCapture.requested != nil
    #else
      return false
    #endif
  }
  var configURL: URL {
    #if DEBUG
      if let path = ProcessInfo.processInfo.environment["TELEGATE_TEST_CONFIG"] {
        return URL(fileURLWithPath: path)
      }
    #endif
    return FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
      .appendingPathComponent("Telegate/computer.json")
  }
  init() {
    if let data = try? Data(contentsOf: configURL),
      let config = try? JSONDecoder().decode(ComputerConfiguration.self, from: data)
    {
      service = config.service
      name = config.name
      deviceId = config.deviceId
      deviceToken = config.deviceToken
      harnesses = config.harnesses
    }
    if deviceToken == nil, deviceId != nil, !isPreviewCapture {
      // Earlier builds kept the token in the macOS keychain. Move it into the config
      // file once if it can be read; otherwise the window offers a one-step re-pair.
      let legacy = SecureStore.lookup("computer")
      if let token = legacy.value {
        deviceToken = token
        if (try? save()) != nil {
          SecureStore.remove("computer")
          SecureStore.remove("pending-computer")
        }
      } else {
        credentialProblem = "the earlier build stored it in the macOS keychain and it can’t be read (\(SecureStore.describe(legacy.status)))"
      }
    }
    node =
      UserDefaults.standard.string(forKey: "nodeExecutable")
      ?? (["/opt/homebrew/bin/node", "/usr/local/bin/node"].first {
        FileManager.default.isExecutableFile(atPath: $0)
      } ?? "")
  }
  func save(requireService: Bool = true, clearChecks: Bool = true) throws {
    guard (!requireService && service.isEmpty) || AppConfiguration.validService(service) != nil else {
      throw UserFacingError(message: "Enter your Telegate HTTPS service address.")
    }
    for h in harnesses {
      guard !h.name.trimmingCharacters(in: .whitespaces).isEmpty else {
        throw UserFacingError(message: "Give the agent a name.")
      }
      if h.kind == "webhook" {
        guard URL(string: h.url)?.scheme == "https" else {
          throw UserFacingError(message: "Enter an HTTPS endpoint URL.")
        }
      } else {
        var directory: ObjCBool = false
        guard FileManager.default.fileExists(atPath: h.cwd, isDirectory: &directory),
          directory.boolValue, !h.command.isEmpty
        else {
          throw UserFacingError(
            message: "Choose an existing folder and an executable for \(h.name).")
        }
      }
    }
    #if DEBUG
      if DesignPreviewCapture.requested != nil {
        if clearChecks {
          checkedHarnesses = []
          checkMessage = nil
        }
        return
      }
    #endif
    let value = ComputerConfiguration(
      service: service, name: name, deviceId: deviceId, deviceToken: deviceToken, harnesses: harnesses)
    try FileManager.default.createDirectory(
      at: configURL.deletingLastPathComponent(), withIntermediateDirectories: true,
      attributes: [.posixPermissions: 0o700])
    try JSONEncoder().encode(value).write(to: configURL, options: .atomic)
    try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: configURL.path)
    UserDefaults.standard.set(node, forKey: "nodeExecutable")
    if clearChecks {
      checkedHarnesses = []
      checkMessage = nil
    }
  }
  func checkSetup() async {
    guard !checking else { return }
    checking = true
    defer { checking = false }
    do {
      try save()
      guard FileManager.default.isExecutableFile(atPath: node),
        let script = Bundle.main.url(forResource: "cli", withExtension: "mjs", subdirectory: "companion")
      else { throw UserFacingError(message: "Choose Node.js 24 or newer in Settings › Advanced.") }
      let p = Process()
      p.executableURL = URL(fileURLWithPath: node)
      p.arguments = [script.path, "check"]
      var env = ProcessInfo.processInfo.environment
      env["PATH"] = "/opt/homebrew/bin:/usr/local/bin:\(FileManager.default.homeDirectoryForCurrentUser.path)/.local/bin:" + (env["PATH"] ?? "/usr/bin:/bin")
      env["TELEGATE_CONFIG"] = configURL.path
      p.environment = env
      let output = Pipe()
      p.standardOutput = output
      p.standardError = FileHandle.nullDevice
      let data: Data = try await withCheckedThrowingContinuation { continuation in
        p.terminationHandler = { process in
          let data = output.fileHandleForReading.readDataToEndOfFile()
          if process.terminationStatus == 0 { continuation.resume(returning: data) }
          else { continuation.resume(throwing: UserFacingError(message: "Agent check failed. Verify Node.js 24+ and your agent installations.")) }
        }
        do { try p.run() } catch { continuation.resume(throwing: error) }
      }
      struct Report: Decodable { var harnesses: [Harness] }
      checkedHarnesses = try JSONDecoder().decode(Report.self, from: data).harnesses
      struct Health: Decodable { var status: String }
      let health: Health = try await RelayAPI(service: service).request("/health")
      guard health.status == "ok" else { throw UserFacingError(message: "The service did not report healthy.") }
      let count = checkedHarnesses.filter(\.enabled).count
      checkMessage = "Service reachable · \(count) agent\(count == 1 ? "" : "s") available. Send a small test task from your phone to verify agent sign-in, then test a file edit to confirm permissions."
      error = nil
    } catch { self.error = error.localizedDescription }
  }
  func beginPairing() async {
    guard !busy else { return }
    busy = true
    error = nil
    defer { busy = false }
    do {
      try save()
      var bytes = [UInt8](repeating: 0, count: 32)
      guard SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes) == errSecSuccess else {
        throw UserFacingError(message: "Couldn’t create a computer credential.")
      }
      let secret = Data(bytes).base64EncodedString()
      pendingSecret = secret
      let digest = SHA256.hash(data: Data(secret.utf8)).map { String(format: "%02x", $0) }.joined()
      let summaries = harnesses.map {
        ["id": $0.id, "name": $0.name, "kind": $0.kind, "enabled": $0.enabled] as [String: Any]
      }
      let api = RelayAPI(service: service, token: nil)
      pair = try await api.request(
        "/v1/pair/start",
        body: ["tokenHash": digest, "name": name, "platform": "darwin", "harnesses": summaries])
      pairingWork?.cancel()
      pairingWork = Task {
        do {
          while !Task.isCancelled, let pair = self.pair,
            Date().timeIntervalSince1970 * 1000 < pair.expiresAt
          {
            try await Task.sleep(for: .seconds(2))
            let status: PairStatus = try await RelayAPI(service: self.service, token: secret)
              .request("/v1/pair/status")
            if status.status == "paired" {
              self.deviceToken = secret
              self.pendingSecret = nil
              self.credentialProblem = nil
              self.deviceId = status.deviceId
              self.pair = nil
              try self.save()
              self.start()
              return
            }
          }
          if !Task.isCancelled {
            self.error = "Pairing expired. Get a new code."
            self.pair = nil
          }
        } catch {
          if !Task.isCancelled {
            self.error = error.localizedDescription
            self.pair = nil
          }
        }
      }
    } catch { self.error = error.localizedDescription }
  }
  func start() {
    guard process == nil else { return }
    error = nil
    do {
      try save(clearChecks: false)
      guard deviceId != nil else {
        throw UserFacingError(message: "Pair this Mac with your phone first.")
      }
      guard let secret = deviceToken else {
        if credentialProblem == nil { credentialProblem = "no device token is stored for this pairing" }
        log += "No stored device token for this pairing; re-pair to continue.\n"
        throw UserFacingError(
          message: "This Mac is paired, but no device token is stored for it. Press Re-pair This Mac to get a new code.")
      }
      credentialProblem = nil
      guard FileManager.default.isExecutableFile(atPath: node) else {
        throw UserFacingError(message: "Install Node.js 24 or newer and choose its executable.")
      }
      guard
        let script = Bundle.main.url(
          forResource: "cli", withExtension: "mjs", subdirectory: "companion")
      else { throw UserFacingError(message: "The connector is missing from this build.") }
      let p = Process()
      p.executableURL = URL(fileURLWithPath: node)
      p.arguments = [script.path, "run"]
      var env = ProcessInfo.processInfo.environment
      env["PATH"] =
        "/opt/homebrew/bin:/usr/local/bin:\(FileManager.default.homeDirectoryForCurrentUser.path)/.local/bin:"
        + (env["PATH"] ?? "/usr/bin:/bin")
      env["TELEGATE_CONFIG"] = configURL.path
      env["TELEGATE_DEVICE_TOKEN"] = secret
      p.environment = env
      let pipe = Pipe()
      p.standardOutput = pipe
      p.standardError = pipe
      pipe.fileHandleForReading.readabilityHandler = { [weak self] handle in
        let data = handle.availableData
        guard !data.isEmpty else { return }
        Task { @MainActor in
          self?.log += String(data: data, encoding: .utf8) ?? ""
          if let s = self?.log, self?.log.count ?? 0 > 12000 { self?.log = String(s.suffix(12000)) }
        }
      }
      p.terminationHandler = { [weak self] process in
        pipe.fileHandleForReading.readabilityHandler = nil
        Task { @MainActor in
          guard let self else { return }
          self.stopWatchdog?.cancel()
          self.connected = false
          self.stopping = false
          self.stopTimedOut = false
          self.restarting = false
          self.process = nil
          let wasUserStop = self.userInitiatedStop
          self.userInitiatedStop = false
          if self.error == "Connector is still stopping." { self.error = nil }
          if let next = self.afterExit {
            self.afterExit = nil
            next()
            return
          }
          if process.terminationStatus == 2 {
            // The relay no longer accepts this Mac's token: the phone disconnected it.
            self.resetPairing()
            self.error = "Your phone disconnected this Mac. Pair again to reconnect."
          } else if !wasUserStop {
            self.error = process.terminationStatus == 0
              ? "Connector stopped on its own. Check Activity; if the computer was revoked, pair again."
              : "Connector stopped. Check Activity; if the computer was revoked, pair again."
          }
        }
      }
      try p.run()
      process = p
      connected = true
      log += "Connector started. Waiting for work.\n"
    } catch {
      restarting = false
      self.error = error.localizedDescription
    }
  }
  func stop() {
    guard let process, !stopping else { return }
    userInitiatedStop = true
    stopping = true
    process.interrupt()
    stopWatchdog?.cancel()
    stopWatchdog = Task { [weak self] in
      try? await Task.sleep(for: .seconds(10))
      guard let self, self.process != nil else { return }
      self.stopTimedOut = true
      self.error = "Connector is still stopping."
    }
  }
  func resetPairing() {
    guard process == nil else {
      error = "Stop the connector before pairing again."
      return
    }
    SecureStore.remove("computer")
    SecureStore.remove("pending-computer")
    deviceToken = nil
    pendingSecret = nil
    deviceId = nil
    pair = nil
    credentialProblem = nil
    error = nil
    pairingWork?.cancel()
    try? save()
  }
  /// Forget the old pairing and start a fresh one, stopping the connector first if needed.
  func repair() {
    let begin: () -> Void = { [weak self] in
      guard let self else { return }
      self.resetPairing()
      guard self.deviceId == nil else { return }
      Task { await self.beginPairing() }
    }
    if process != nil {
      restarting = false  // a re-pair takes over any pending restart
      afterExit = begin
      stop()
    } else {
      begin()
    }
  }
  func setLaunchAtLogin(_ value: Bool) {
    do {
      if value {
        try SMAppService.mainApp.register()
      } else {
        try SMAppService.mainApp.unregister()
      }
      launchAtLogin = value
    } catch { self.error = error.localizedDescription }
  }
}

// MARK: - App

@MainActor final class AppDelegate: NSObject, NSApplicationDelegate {
  let model = ConnectModel()

  func applicationDidFinishLaunching(_ notification: Notification) {
    #if DEBUG
      if DesignPreviewCapture.requested != nil { return }
    #endif
    if model.deviceId != nil { model.start() }
  }

  func applicationShouldTerminate(_ sender: NSApplication) -> NSApplication.TerminateReply {
    guard model.hasProcess else { return .terminateNow }
    model.stopForQuit()
    Task { @MainActor in
      for _ in 0..<20 {
        if !model.hasProcess { break }
        try? await Task.sleep(for: .milliseconds(100))
      }
      if model.hasProcess {
        model.forceStop()
        try? await Task.sleep(for: .milliseconds(300))
      }
      sender.reply(toApplicationShouldTerminate: true)
    }
    return .terminateLater
  }

  func applicationShouldHandleReopen(_ sender: NSApplication, hasVisibleWindows flag: Bool) -> Bool {
    true  // SwiftUI reopens the main WindowGroup window itself
  }
}

@main struct TelegateConnectApp: App {
  @NSApplicationDelegateAdaptor(AppDelegate.self) private var delegate
  private var ui: ConnectUI { ConnectUI.shared }

  var body: some Scene {
        // The root view keeps the exact identity ConnectView().environmentObject(model).frame(...).onAppear
    // that earlier builds had: on macOS 26 the launch window of an app with previous state is only
    // presented for a known window identity, and this identity is what those builds registered.
    WindowGroup {
      ConnectView().environmentObject(delegate.model).frame(minWidth: 680, minHeight: 560).onAppear {}
    }
    .defaultSize(width: 760, height: 620)
    .windowResizability(.contentMinSize)
    .windowToolbarStyle(.unified(showsTitle: true))
    .commands { ConnectCommands(model: delegate.model, ui: ui) }

    Window("Activity", id: "activity") {
      ActivityView()
        .environmentObject(delegate.model)
        .environmentObject(ui)
        .frame(minWidth: 480, minHeight: 300)
    }
    .defaultSize(width: 640, height: 420)
    .windowToolbarStyle(.unified(showsTitle: true))

    Settings {
      SettingsView()
        .environmentObject(delegate.model)
        .environmentObject(ui)
    }

    MenuBarExtra {
      MenuBarContent()
        .environmentObject(delegate.model)
        .environmentObject(ui)
    } label: {
      MenuBarLabel(model: delegate.model)
    }
    .menuBarExtraStyle(.menu)
  }
}

/// The status item image must observe the model; the App body itself never re-evaluates.
struct MenuBarLabel: View {
  @ObservedObject var model: ConnectModel
  var body: some View {
    Image(nsImage: MenuBarIcon.image(for: model.connectorState))
      .accessibilityLabel("Telegate Connect, \(model.menuTitle)")
  }
}
