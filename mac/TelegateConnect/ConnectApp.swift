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
  func save(requireService: Bool = true) throws {
    guard (!requireService && service.isEmpty) || AppConfiguration.validService(service) != nil else {
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
      ConnectView().environmentObject(model).frame(minWidth: 720, minHeight: 680).onAppear {
        if model.deviceId != nil { model.start() }
      }
    }
    .defaultSize(width: 780, height: 860)
    .windowStyle(.hiddenTitleBar)
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
#if DEBUG
  // Design review only: `--render-preview main|editor|settings <file.png>` captures the real
  // window (or its open sheet) shortly after launch, writes a PNG, and exits. It opens a sheet
  // without saving anything and never changes the stored configuration.
  @MainActor enum DesignPreviewCapture {
    static var requested: (screen: String, path: String)? {
      let arguments = CommandLine.arguments
      guard let index = arguments.firstIndex(of: "--render-preview"), index + 2 < arguments.count
      else { return nil }
      return (arguments[index + 1], arguments[index + 2])
    }
    static func capture(to path: String) async {
      try? await Task.sleep(for: .seconds(1.5))
      let window = NSApp.windows.first { $0.isVisible && !($0 is NSPanel) }
      let target = window?.attachedSheet ?? window
      guard let view = target?.contentView,
        let rep = view.bitmapImageRepForCachingDisplay(in: view.bounds)
      else { exit(2) }
      view.cacheDisplay(in: view.bounds, to: rep)
      let png = rep.representation(using: NSBitmapImageRep.FileType.png, properties: [:])
      do {
        try png?.write(to: URL(fileURLWithPath: path))
        exit(0)
      } catch { exit(3) }
    }
  }
#endif
private enum ConnectStyle {
  static let ink = Color(red: 0.12, green: 0.18, blue: 0.15)
  static let accent = Color(red: 0.22, green: 0.36, blue: 0.26)
  static let canvas = Color(nsColor: NSColor(name: nil) { appearance in
    appearance.bestMatch(from: [.darkAqua, .aqua]) == .darkAqua
      ? NSColor(calibratedWhite: 0.10, alpha: 1)
      : NSColor(calibratedRed: 0.965, green: 0.969, blue: 0.955, alpha: 1)
  })
  static let card = Color(nsColor: .controlBackgroundColor)
}

private enum AgentBrand: String, CaseIterable, Identifiable {
  case codex, claude, openclaw, hermes, grok, custom
  var id: String { rawValue }
  var name: String {
    switch self {
    case .codex: "Codex"
    case .claude: "Claude Code"
    case .openclaw: "OpenClaw"
    case .hermes: "Hermes Agent"
    case .grok: "Grok Bot"
    case .custom: "Other agent"
    }
  }
  var detail: String {
    switch self {
    case .codex: "Code & build"
    case .claude: "Code & research"
    case .openclaw: "Personal assistant"
    case .hermes: "Tasks & research"
    case .grok: "Cloud assistant"
    case .custom: "Connect your tools"
    }
  }
  var tint: Color {
    switch self {
    case .claude: Color(red: 0.83, green: 0.47, blue: 0.34)
    case .openclaw: .red
    case .hermes: Color(red: 0.52, green: 0.38, blue: 0.74)
    default: ConnectStyle.accent
    }
  }
  static func forHarness(_ h: LocalHarness) -> AgentBrand {
    if h.kind == "webhook" { return h.name.lowercased().contains("grok") ? .grok : .custom }
    return AgentBrand(rawValue: h.kind) ?? .custom
  }
  func harness(service: String) -> LocalHarness {
    var h = LocalHarness()
    h.name = name
    h.kind = self == .grok || self == .custom ? "webhook" : rawValue
    h.command = h.kind == "webhook" ? "" : ExecutableLocator.find(rawValue)
    if self == .grok, let base = AppConfiguration.validService(service) {
      h.url = URL(string: "/v1/adapters/grokbot/tasks", relativeTo: base)?.absoluteString ?? ""
    }
    return h
  }
}

private struct AgentIcon: View {
  var brand: AgentBrand
  var size: CGFloat = 44
  var body: some View {
    ZStack {
      RoundedRectangle(cornerRadius: size * 0.27).fill(.white)
      RoundedRectangle(cornerRadius: size * 0.27).fill(brand.tint.opacity(0.09))
      if brand == .hermes {
        // Hermes' official favicon uses the caduceus character.
        Text("☤").font(.system(size: size * 0.7)).foregroundStyle(brand.tint)
      } else if brand == .custom {
        Image(systemName: "square.stack.3d.up").font(.system(size: size * 0.47)).foregroundStyle(brand.tint)
      } else {
        Image("Harness-\(brand.rawValue)").resizable().scaledToFit()
          .frame(width: size * 0.60, height: size * 0.60)
      }
    }.frame(width: size, height: size).accessibilityHidden(true)
  }
}

struct ConnectView: View {
  @EnvironmentObject var model: ConnectModel
  @State private var editing: LocalHarness?
  @State private var showSettings = false
  @State private var showActivity = false
  private var locked: Bool { model.connected || model.pair != nil || model.busy }
  var body: some View {
    VStack(spacing: 0) {
      header
      ScrollView {
        VStack(alignment: .leading, spacing: 26) {
          connectionCard
          if let error = model.error {
            Label(error, systemImage: "exclamationmark.circle.fill")
              .font(.callout).foregroundStyle(.red).textSelection(.enabled)
              .padding(16).frame(maxWidth: .infinity, alignment: .leading)
              .background(.red.opacity(0.06), in: RoundedRectangle(cornerRadius: 14))
          }
          selectedAgents
          agentCatalog
          HStack(alignment: .top, spacing: 10) {
            Image(systemName: "lock.shield").font(.title3)
            Text("Your voice and OpenAI key stay on your phone. This Mac receives the work you choose to send.")
              .font(.callout).fixedSize(horizontal: false, vertical: true)
          }.foregroundStyle(.secondary).padding(.horizontal, 4)
        }.padding(28).frame(maxWidth: 920)
          .frame(maxWidth: .infinity)
      }
      footer
    }
    .background(ConnectStyle.canvas).tint(ConnectStyle.accent)
    #if DEBUG
      .task {
        guard let preview = DesignPreviewCapture.requested else { return }
        if preview.screen == "editor" { editing = model.harnesses.first ?? AgentBrand.claude.harness(service: model.service) }
        if preview.screen == "settings" { showSettings = true }
        await DesignPreviewCapture.capture(to: preview.path)
      }
    #endif
    .sheet(item: $editing) { harness in
      AgentEditor(model: model, original: harness)
    }
    .sheet(isPresented: $showSettings) { ConnectSettings(model: model) }
    .sheet(isPresented: $showActivity) {
      VStack(alignment: .leading, spacing: 16) {
        HStack {
          Text("Connection activity").font(.title2.bold())
          Spacer()
          Button("Done") { showActivity = false }
        }
        ScrollView {
          Text(model.log.isEmpty ? "No activity yet. Pair your phone to get started." : model.log)
            .font(.system(.caption, design: .monospaced)).textSelection(.enabled)
            .frame(maxWidth: .infinity, alignment: .leading)
        }
      }.padding(24).frame(width: 600, height: 400)
    }
  }
  private var header: some View {
    HStack(spacing: 12) {
      Image(systemName: "phone.arrow.up.right.fill")
        .font(.system(size: 23, weight: .semibold)).foregroundStyle(ConnectStyle.accent)
        .frame(width: 46, height: 46)
        .background(ConnectStyle.accent.opacity(0.1), in: RoundedRectangle(cornerRadius: 14))
      VStack(alignment: .leading, spacing: 2) {
        Text("telegate").font(.system(size: 24, weight: .bold, design: .rounded))
        Text("CONNECT").font(.system(size: 10, weight: .semibold)).tracking(2.5).foregroundStyle(.secondary)
      }
      Spacer()
      Button { showSettings = true } label: {
        Label("Settings", systemImage: "slider.horizontal.3")
      }.buttonStyle(.bordered).controlSize(.large)
    }.padding(.horizontal, 28).padding(.top, 26).padding(.bottom, 20)
  }
  private var connectionCard: some View {
    VStack(alignment: .leading, spacing: 22) {
      HStack(alignment: .top, spacing: 18) {
        Image(systemName: "desktopcomputer").font(.system(size: 38, weight: .light))
          .foregroundStyle(ConnectStyle.accent).frame(width: 70, height: 70)
          .background(ConnectStyle.accent.opacity(0.08), in: RoundedRectangle(cornerRadius: 20))
        VStack(alignment: .leading, spacing: 7) {
          Text(model.deviceId == nil ? "Your desk. On call." : "Take your ideas with you.")
            .font(.system(size: 27, weight: .semibold, design: .rounded))
          Text(model.name).font(.callout).foregroundStyle(.secondary)
          Label(model.connected ? "Connector running" : model.deviceId != nil ? "Paired · paused" : "Not paired yet",
                systemImage: model.connected ? "circle.fill" : "circle")
            .font(.caption.weight(.medium)).foregroundStyle(model.connected ? ConnectStyle.accent : .secondary)
        }
        Spacer(minLength: 0)
      }
      if let pair = model.pair {
        VStack(alignment: .leading, spacing: 12) {
          Text("Open Telegate on your phone → Computers → Add computer.")
            .font(.callout)
          HStack {
            Text(String(pair.code.prefix(5)) + "-" + String(pair.code.suffix(5)))
              .font(.system(size: 32, weight: .semibold, design: .monospaced)).textSelection(.enabled)
            Spacer()
            Button("Copy code", systemImage: "doc.on.doc") {
              NSPasteboard.general.clearContents()
              NSPasteboard.general.setString(pair.code, forType: .string)
            }
          }
          Text("Use the same service address on both devices. This code expires in 10 minutes.")
            .font(.caption).foregroundStyle(.secondary)
          HStack {
            Button("Copy service address") {
              NSPasteboard.general.clearContents()
              NSPasteboard.general.setString(model.service, forType: .string)
            }
            Button("Cancel pairing") { model.resetPairing() }
          }
        }.padding(18).background(ConnectStyle.accent.opacity(0.06), in: RoundedRectangle(cornerRadius: 16))
      } else {
        if let address = AppConfiguration.normalizedService(model.service) {
          VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 10) {
              Image(systemName: "link").foregroundStyle(.secondary)
              Text(address).font(.system(.callout, design: .monospaced)).textSelection(.enabled)
                .lineLimit(1).truncationMode(.middle)
              Spacer(minLength: 8)
              Button("Copy address", systemImage: "doc.on.doc") { copy(address) }
                .buttonStyle(.borderless).help("Copy the service address to enter on your phone")
            }
            Text(address.contains("trycloudflare.com")
                 ? "Temporary test address. Enter this same address on your phone. If it changes after a restart, update it here and in the phone’s Settings."
                 : "Enter this same address on your phone.")
              .font(.caption).foregroundStyle(address.contains("trycloudflare.com") ? .orange : .secondary)
          }.padding(14).background(ConnectStyle.accent.opacity(0.05), in: RoundedRectangle(cornerRadius: 14))
        }
        HStack(spacing: 18) {
          Text(model.deviceId == nil
               ? "Pair your phone. Pick your agents.\nSend work from wherever inspiration finds you."
               : "Keep this app open and your Mac awake.\nCheck your phone to see when this computer is online.")
            .font(.callout).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
          Spacer(minLength: 0)
          Button {
            if model.deviceId != nil {
              if model.connected { model.stop() } else { model.start() }
            } else if AppConfiguration.validService(model.service) == nil {
              showSettings = true
            } else { Task { await model.beginPairing() } }
          } label: {
            HStack(spacing: 8) {
              if model.busy { ProgressView().controlSize(.small) }
              Text(model.deviceId == nil ? "Pair my phone" : model.connected ? "Pause connection" : "Start connection")
              if model.deviceId == nil { Image(systemName: "arrow.right") }
            }.padding(.horizontal, 8).padding(.vertical, 7)
          }.buttonStyle(.borderedProminent).controlSize(.large)
            .disabled(model.busy || model.harnesses.isEmpty)
        }
      }
    }.padding(24).background(ConnectStyle.card, in: RoundedRectangle(cornerRadius: 24))
      .overlay(RoundedRectangle(cornerRadius: 24).strokeBorder(.primary.opacity(0.05)))
  }
  private var selectedAgents: some View {
    VStack(alignment: .leading, spacing: 12) {
      HStack {
        Text("Your agents").font(.title3.weight(.semibold))
        Text("\(model.harnesses.filter(\.enabled).count) selected").font(.caption).foregroundStyle(.secondary)
        Spacer()
        if locked { Text(model.pair != nil ? "Cancel pairing to edit" : "Pause to edit").font(.caption).foregroundStyle(.secondary) }
      }
      if model.harnesses.isEmpty {
        Text("Choose an agent below to receive your first idea.").foregroundStyle(.secondary)
          .padding(20).frame(maxWidth: .infinity, alignment: .leading)
          .background(ConnectStyle.card, in: RoundedRectangle(cornerRadius: 16))
      }
      ForEach(model.harnesses) { h in
        HStack(spacing: 14) {
          AgentIcon(brand: .forHarness(h))
          VStack(alignment: .leading, spacing: 4) {
            Text(h.name).font(.body.weight(.semibold))
            Text(h.kind == "webhook" ? "Cloud connection" : "On this Mac")
              .font(.caption).foregroundStyle(.secondary)
          }
          Spacer()
          Button("Configure") { editing = h }.buttonStyle(.borderless).disabled(locked)
          Toggle("Use \(h.name)", isOn: Binding(get: { h.enabled }, set: { enabled in
            guard let index = model.harnesses.firstIndex(where: { $0.id == h.id }) else { return }
            model.harnesses[index].enabled = enabled
            do { try model.save(requireService: false); model.error = nil }
            catch { model.harnesses[index].enabled = h.enabled; model.error = error.localizedDescription }
          })).labelsHidden().toggleStyle(.switch).controlSize(.small).disabled(locked)
        }.padding(16).background(ConnectStyle.card, in: RoundedRectangle(cornerRadius: 16))
      }
    }
  }
  private var agentCatalog: some View {
    VStack(alignment: .leading, spacing: 12) {
      Text("Add an agent").font(.title3.weight(.semibold))
      LazyVGrid(columns: Array(repeating: GridItem(.flexible(), spacing: 12), count: 3), spacing: 12) {
        ForEach(AgentBrand.allCases) { brand in
          Button { editing = brand.harness(service: model.service) } label: {
            HStack(spacing: 12) {
              AgentIcon(brand: brand, size: 38)
              VStack(alignment: .leading, spacing: 4) {
                Text(brand.name).font(.callout.weight(.semibold)).foregroundStyle(.primary)
                Text(brand.detail).font(.system(size: 11)).foregroundStyle(.secondary)
              }
              Spacer(minLength: 0)
            }.padding(14).frame(maxWidth: .infinity, minHeight: 56, alignment: .leading)
              .background(ConnectStyle.card, in: RoundedRectangle(cornerRadius: 16))
          }.buttonStyle(.plain).disabled(locked).accessibilityLabel("Add \(brand.name)")
        }
      }
    }
  }
  private func copy(_ value: String) {
    NSPasteboard.general.clearContents()
    NSPasteboard.general.setString(value, forType: .string)
  }
  private var footer: some View {
    HStack {
      Toggle("Open at login", isOn: Binding(get: { model.launchAtLogin }, set: { model.setLaunchAtLogin($0) }))
        .toggleStyle(.switch).controlSize(.small)
      Spacer()
      Button("Activity", systemImage: "waveform.path") { showActivity = true }.buttonStyle(.borderless)
      Link("Help", destination: URL(string: "https://github.com/danielfoch/telegate#readme")!).font(.callout)
    }.padding(.horizontal, 28).padding(.vertical, 16)
      .background(ConnectStyle.card)
  }
}

private struct AgentEditor: View {
  @ObservedObject var model: ConnectModel
  @Environment(\.dismiss) private var dismiss
  @State private var draft: LocalHarness
  @State private var error: String?
  @State private var advanced = false
  private let isNew: Bool
  init(model: ConnectModel, original: LocalHarness) {
    self.model = model
    _draft = State(initialValue: original)
    isNew = !model.harnesses.contains { $0.id == original.id }
  }
  var body: some View {
    VStack(alignment: .leading, spacing: 20) {
      HStack(spacing: 14) {
        AgentIcon(brand: .forHarness(draft), size: 52)
        VStack(alignment: .leading, spacing: 4) {
          Text(isNew ? "Add \(draft.name)" : draft.name).font(.title2.bold())
          Text("Choose how this agent receives your work.").foregroundStyle(.secondary)
        }
        Spacer()
      }
      Form {
        TextField("Name", text: $draft.name)
        if AgentBrand.forHarness(draft) == .custom {
          Picker("Connection", selection: $draft.kind) {
            Text("Cloud service").tag("webhook")
            Text("Local command").tag("command")
          }
        }
        if draft.kind == "webhook" {
          TextField("Connection URL", text: $draft.url)
          SecureField("Connection key", text: $draft.token)
          Text(draft.name.lowercased().contains("grok")
               ? "Use the Grok Bot adapter address and connection key from your relay administrator."
               : "Your service needs to accept Telegate tasks and send results back.")
            .font(.caption).foregroundStyle(.secondary)
          Link("Connection guide", destination: URL(string: "https://github.com/danielfoch/telegate/blob/main/docs/integrations/\(draft.name.lowercased().contains("grok") ? "GROKBOT.md" : "../API.md")")!)
        } else {
          HStack {
            VStack(alignment: .leading, spacing: 4) {
              Text("Project folder").font(.callout.weight(.medium))
              Text(draft.cwd).font(.caption).foregroundStyle(.secondary).lineLimit(2).textSelection(.enabled)
            }
            Spacer()
            Button("Choose folder…") {
              let panel = NSOpenPanel()
              panel.canChooseDirectories = true
              panel.canChooseFiles = false
              panel.directoryURL = URL(fileURLWithPath: draft.cwd)
              if panel.runModal() == .OK { draft.cwd = panel.url?.path ?? draft.cwd }
            }
          }
          Toggle("Let voice know what I’m working on", isOn: $draft.shareProjectContext)
          Text("Shares the folder name, branch, change count and latest commit subject. Your source files stay here.")
            .font(.caption).foregroundStyle(.secondary)
          if draft.kind == "openclaw" {
            Text("Work runs in your OpenClaw agent’s own workspace. This folder is used for project awareness.")
              .font(.caption).foregroundStyle(.secondary)
          }
          if ["codex", "claude"].contains(draft.kind) {
            Picker("Approvals", selection: $draft.approvalMode) {
              Text("Automatic review (recommended)").tag("auto")
              if draft.kind == "claude" { Text("File edits only").tag("edits") }
              Text("Full access, no sandbox").tag("bypass")
            }
            Text(approvalNote).font(.caption).foregroundStyle(draft.approvalMode == "bypass" ? .orange : .secondary)
          }
          DisclosureGroup("Advanced settings", isExpanded: $advanced) {
            TextField("Executable", text: $draft.command)
            if draft.kind == "openclaw" {
              TextField("Agent ID", text: Binding(get: { draft.agentId ?? "main" }, set: { draft.agentId = $0 }))
            }
            if draft.kind == "command" {
              TextField("Arguments (one per line)", text: Binding(
                get: { draft.args.joined(separator: "\n") },
                set: { draft.args = $0.split(separator: "\n").map(String.init) }), axis: .vertical)
              Text("Telegate sends the brief on standard input.").font(.caption).foregroundStyle(.secondary)
            }
            Stepper("Time limit: \(draft.timeoutMinutes) minutes", value: $draft.timeoutMinutes, in: 15...1440, step: 15)
          }
          Text("Uses your agent’s existing account, model and permissions. Install and sign in to the agent first.")
            .font(.caption).foregroundStyle(.secondary)
        }
      }.formStyle(.grouped)
      if let error { Text(error).foregroundStyle(.red).font(.callout) }
      HStack {
        if !isNew {
          Button("Remove agent", role: .destructive) { commit(remove: true) }.buttonStyle(.borderless)
        }
        Spacer()
        Button("Cancel") { dismiss() }.keyboardShortcut(.cancelAction)
        Button(isNew ? "Add agent" : "Save changes") { commit() }
          .buttonStyle(.borderedProminent).keyboardShortcut(.defaultAction)
      }
    }.padding(24).frame(width: 560, height: 550).tint(ConnectStyle.accent)
  }
  private var approvalNote: String {
    switch (draft.kind, draft.approvalMode) {
    case ("codex", "bypass"), ("claude", "bypass"):
      "Runs with no sandbox and no approval prompts. Only for folders you fully trust."
    case ("claude", "edits"):
      "Claude Code edits files on its own. Commands that need approval are denied while unattended, so some tasks come back needing attention."
    case ("claude", _):
      "Claude Code auto mode approves routine actions itself and declines risky ones. Requires a Claude Code version and plan with auto mode."
    default:
      "Codex reviews its own commands inside its workspace sandbox, the same as codex exec --approve-for-me."
    }
  }
  private func commit(remove: Bool = false) {
    let previous = model.harnesses
    model.harnesses.removeAll { $0.id == draft.id }
    if !remove {
      if let index = previous.firstIndex(where: { $0.id == draft.id }) { model.harnesses.insert(draft, at: index) }
      else { model.harnesses.append(draft) }
    }
    do { try model.save(requireService: false); model.error = nil; dismiss() }
    catch { model.harnesses = previous; self.error = error.localizedDescription }
  }
}

private struct ConnectSettings: View {
  @ObservedObject var model: ConnectModel
  @Environment(\.dismiss) private var dismiss
  @State private var service = ""
  @State private var name = ""
  @State private var node = ""
  @State private var error: String?
  var body: some View {
    VStack(alignment: .leading, spacing: 18) {
      Text("Connection settings").font(.title2.bold())
      Text("Give this computer a name you’ll recognize on your phone.").foregroundStyle(.secondary)
      Form {
        TextField("Computer name", text: $name).disabled(model.connected || model.pair != nil)
        Section("Telegate service") {
          TextField("HTTPS address", text: $service).disabled(model.connected || model.pair != nil)
          Text(model.connected
               ? "Pause the connection to change this address."
               : "Use the same address in the phone app. Your pairing stays valid when the same relay answers at a new address.")
            .font(.caption).foregroundStyle(.secondary)
          if model.service.contains("trycloudflare.com") {
            Text("This is a temporary test address. Keep the relay and tunnel running; a permanent host is needed for everyday use.")
              .font(.caption).foregroundStyle(.orange)
          }
        }
        DisclosureGroup("Advanced") {
          TextField("Node executable", text: $node).disabled(model.connected)
          Link("Install Node.js 24 or newer", destination: URL(string: "https://nodejs.org/en/download")!)
          if model.deviceId != nil {
            Button("Unpair this Mac") { model.resetPairing() }.disabled(model.connected)
            Text("Pause the connection first. Unpair only when moving to a different relay or account.").font(.caption).foregroundStyle(.secondary)
          }
        }
      }.formStyle(.grouped)
      if let error { Text(error).foregroundStyle(.red).font(.callout) }
      HStack {
        Spacer()
        Button("Cancel") { dismiss() }.keyboardShortcut(.cancelAction)
        Button("Save") {
          let previous = (model.service, model.name, model.node)
          let trimmed = service.trimmingCharacters(in: .whitespacesAndNewlines)
          model.service = AppConfiguration.normalizedService(trimmed) ?? trimmed
          model.name = name
          model.node = node
          do { try model.save(); model.error = nil; dismiss() }
          catch {
            (model.service, model.name, model.node) = previous
            self.error = error.localizedDescription
          }
        }.buttonStyle(.borderedProminent).keyboardShortcut(.defaultAction)
      }
    }.padding(24).frame(width: 540, height: 450).tint(ConnectStyle.accent)
      .onAppear { service = model.service; name = model.name; node = model.node }
  }
}
