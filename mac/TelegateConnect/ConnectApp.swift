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
  var summary: Harness { Harness(id: id, name: name, kind: kind, enabled: enabled) }
}
struct ComputerConfiguration: Codable {
  var service: String
  var name: String
  var deviceId: String?
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
  @Published var log = ""
  @Published var node = "/opt/homebrew/bin/node"
  @Published var launchAtLogin = SMAppService.mainApp.status == .enabled
  private var process: Process?
  private var pairingWork: Task<Void, Never>?
  var configURL: URL {
    FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask).first!
      .appendingPathComponent("Telegate/computer.json")
  }
  init() {
    if let data = try? Data(contentsOf: configURL),
      let config = try? JSONDecoder().decode(ComputerConfiguration.self, from: data)
    {
      service = config.service
      name = config.name
      deviceId = config.deviceId
      harnesses = config.harnesses
    }
    node =
      UserDefaults.standard.string(forKey: "nodeExecutable")
      ?? (["/opt/homebrew/bin/node", "/usr/local/bin/node"].first {
        FileManager.default.isExecutableFile(atPath: $0)
      } ?? "")
  }
  func save() throws {
    guard AppConfiguration.validService(service) != nil else {
      throw UserFacingError(message: "Enter your Telegate HTTPS service address.")
    }
    for h in harnesses {
      guard !h.name.trimmingCharacters(in: .whitespaces).isEmpty else {
        throw UserFacingError(message: "Name each harness.")
      }
      if h.kind == "webhook" {
        guard URL(string: h.url)?.scheme == "https" else {
          throw UserFacingError(message: "Cloud harnesses need an HTTPS task-submission endpoint.")
        }
      } else {
        var directory: ObjCBool = false
        guard FileManager.default.fileExists(atPath: h.cwd, isDirectory: &directory),
          directory.boolValue, !h.command.isEmpty
        else {
          throw UserFacingError(
            message: "Choose an executable and existing working folder for \(h.name).")
        }
      }
    }
    let value = ComputerConfiguration(
      service: service, name: name, deviceId: deviceId, harnesses: harnesses)
    try FileManager.default.createDirectory(
      at: configURL.deletingLastPathComponent(), withIntermediateDirectories: true,
      attributes: [.posixPermissions: 0o700])
    try JSONEncoder().encode(value).write(to: configURL, options: .atomic)
    try FileManager.default.setAttributes([.posixPermissions: 0o600], ofItemAtPath: configURL.path)
    UserDefaults.standard.set(node, forKey: "nodeExecutable")
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
      try SecureStore.set(secret, for: "pending-computer")
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
              try SecureStore.set(secret, for: "computer")
              SecureStore.remove("pending-computer")
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
      try save()
      guard let secret = SecureStore.get("computer"), deviceId != nil else {
        throw UserFacingError(message: "Pair this Mac with your phone first.")
      }
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
          self?.connected = false
          self?.process = nil
          if process.terminationStatus != 0 {
            self?.error =
              "Connector stopped. Check the activity log; if the computer was revoked, pair again."
          }
        }
      }
      try p.run()
      process = p
      connected = true
      log += "Connector started. Waiting for work.\n"
    } catch { self.error = error.localizedDescription }
  }
  func stop() { process?.interrupt() }
  func resetPairing() {
    guard process == nil else {
      error = "Stop the connector before pairing again."
      return
    }
    SecureStore.remove("computer")
    deviceId = nil
    pair = nil
    pairingWork?.cancel()
    try? save()
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
@main struct TelegateConnectApp: App {
  @StateObject private var model = ConnectModel()
  var body: some Scene {
    WindowGroup {
      ConnectView().environmentObject(model).frame(minWidth: 650, minHeight: 650).onAppear {
        if model.deviceId != nil { model.start() }
      }
    }
    MenuBarExtra("Telegate Connect", systemImage: "phone.arrow.up.right") {
      Text(model.connected ? "Connector running" : "Connector stopped")
      Button(model.connected ? "Stop connector" : "Start connector") {
        if model.connected { model.stop() } else { model.start() }
      }
      Divider()
      Button("Quit Telegate Connect") {
        model.stop()
        NSApplication.shared.terminate(nil)
      }
    }
  }
}
struct ConnectView: View {
  @EnvironmentObject var model: ConnectModel
  var body: some View {
    VStack(alignment: .leading, spacing: 18) {
      HStack {
        Image(systemName: "phone.arrow.up.right.fill").font(.largeTitle).foregroundStyle(.green)
        VStack(alignment: .leading) {
          Text("telegate connect").font(.system(size: 28, weight: .bold, design: .rounded))
          Text("Leave your desk behind. Keep this computer ready for your next idea.").foregroundStyle(.secondary)
        }
        Spacer()
        Circle().fill(model.connected ? .green : .gray).frame(width: 10, height: 10)
      }
      Form {
        Section("This computer") {
          TextField("Service address", text: $model.service).disabled(
            model.deviceId != nil || model.pair != nil)
          TextField("Computer name", text: $model.name).disabled(
            model.connected || model.pair != nil)
          TextField("Node executable", text: $model.node).disabled(model.connected)
          Link(
            "Install Node.js 24 or newer",
            destination: URL(string: "https://nodejs.org/en/download")!)
        }
        Section("Your harnesses") {
          ForEach($model.harnesses) { $h in
            VStack(alignment: .leading, spacing: 10) {
              HStack {
                TextField("Name", text: $h.name)
                Toggle("Enabled", isOn: $h.enabled)
                Button(role: .destructive) {
                  model.harnesses.removeAll { $0.id == h.id }
                } label: {
                  Image(systemName: "trash")
                }.disabled(model.connected)
              }
              Picker("Type", selection: $h.kind) {
                Text("Codex").tag("codex")
                Text("Claude Code").tag("claude")
                Text("Other command").tag("command")
                Text("Cloud endpoint").tag("webhook")
              }.onChange(of: h.kind) { _, v in
                if v == "codex" || v == "claude" {
                  h.command = ExecutableLocator.find(v)
                  h.name = v == "codex" ? "Codex" : "Claude Code"
                }
              }
              if h.kind == "webhook" {
                TextField("HTTPS task-submission URL", text: $h.url)
                SecureField("Endpoint bearer token", text: $h.token)
                Text(
                  "The endpoint must accept a task brief and return its ID or thread URL. Homies/Grokbot require a compatible endpoint from that platform."
                ).font(.caption).foregroundStyle(.secondary)
              } else {
                TextField("Executable", text: $h.command)
                HStack {
                  TextField("Working folder", text: $h.cwd)
                  Button("Choose…") {
                    let p = NSOpenPanel()
                    p.canChooseDirectories = true
                    p.canChooseFiles = false
                    if p.runModal() == .OK { h.cwd = p.url?.path ?? h.cwd }
                  }
                }
                if h.kind == "command" {
                  TextField(
                    "Arguments (one per line)",
                    text: Binding(
                      get: { h.args.joined(separator: "\n") },
                      set: { h.args = $0.split(separator: "\n").map(String.init) }), axis: .vertical
                  )
                  Text(
                    "The task brief arrives on standard input. Commands run with your local harness permissions."
                  ).font(.caption).foregroundStyle(.secondary)
                }
                Toggle("Share project context with my voice app", isOn: $h.shareProjectContext)
                Stepper(
                  "Run limit: \(h.timeoutMinutes) minutes", value: $h.timeoutMinutes, in: 15...1440,
                  step: 15)
                Text(
                  "Shares this folder’s name, Git branch, change count, and latest commit subject. No source files, diffs, credentials, or parent folders are uploaded. Set scan frequency from your phone."
                ).font(.caption).foregroundStyle(.secondary)
              }
            }.padding(.vertical, 8).disabled(model.connected || model.pair != nil)
          }
          Button("Add harness") { model.harnesses.append(LocalHarness()) }.disabled(
            model.connected || model.pair != nil)
        }
        Section("Connect your phone") {
          if let pair = model.pair {
            Text("In Telegate → Computers → Add computer, enter:")
            Text(String(pair.code.prefix(5)) + "-" + String(pair.code.suffix(5))).font(
              .system(size: 34, weight: .bold, design: .monospaced)
            ).textSelection(.enabled)
            Text("Confirm that the phone shows “\(model.name)”. Expires in 10 minutes.").font(
              .caption)
          } else if model.deviceId != nil {
            HStack {
              Button(model.connected ? "Stop connector" : "Start connector") {
                if model.connected { model.stop() } else { model.start() }
              }.buttonStyle(.borderedProminent)
              Button("Pair again") { model.resetPairing() }.disabled(model.connected)
            }
            Text(
              model.connected
                ? "This process is running. Check your phone for the computer’s online heartbeat."
                : "Paired. Start the connector to receive work."
            ).foregroundStyle(.secondary)
          } else {
            Button("Get pairing code") { Task { await model.beginPairing() } }.buttonStyle(
              .borderedProminent
            ).disabled(model.busy || model.harnesses.isEmpty)
          }
          Toggle(
            "Open Telegate Connect at login",
            isOn: Binding(get: { model.launchAtLogin }, set: { model.setLaunchAtLogin($0) }))
        }
        if let error = model.error { Text(error).foregroundStyle(.red) }
        if !model.log.isEmpty {
          Section("Activity") {
            Text(model.log).font(.system(.caption, design: .monospaced)).textSelection(.enabled)
          }
        }
      }.formStyle(.grouped)
      Text(
        "Keep this app running and the computer awake to receive work. Audio and your OpenAI key stay on your phone; this computer receives task briefs."
      ).font(.caption).foregroundStyle(.secondary)
    }.padding(24)
  }
}
