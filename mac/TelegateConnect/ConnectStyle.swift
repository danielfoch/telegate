import AppKit
import SwiftUI

enum ConnectStyle {
  static let window = Color(nsColor: .windowBackgroundColor)
  static let surface = Color(nsColor: .controlBackgroundColor)
  static let text = Color(nsColor: .textBackgroundColor)
  static let border = Color(nsColor: .separatorColor)
  static let mint = Color("Mint")
  static let cardRadius: CGFloat = 10
  static let panelRadius: CGFloat = 8
  static let readme = URL(string: "https://github.com/danielfoch/telegate#readme")!
  static let issues = URL(string: "https://github.com/danielfoch/telegate/issues")!
}

extension View {
  func card() -> some View {
    self
      .background(ConnectStyle.surface, in: RoundedRectangle(cornerRadius: ConnectStyle.cardRadius, style: .continuous))
      .overlay(RoundedRectangle(cornerRadius: ConnectStyle.cardRadius, style: .continuous).strokeBorder(ConnectStyle.border))
  }
}

enum AgentBrand: String, CaseIterable, Identifiable {
  case codex, claude, openclaw, hermes, grok, custom
  var id: String { rawValue }
  var name: String {
    switch self {
    case .codex: "Codex"
    case .claude: "Claude Code"
    case .openclaw: "OpenClaw"
    case .hermes: "Hermes Agent"
    case .grok: "Grok Bot"
    case .custom: "Other"
    }
  }
  var detailSentence: String {
    switch self {
    case .codex: "Runs codex in a folder on this Mac."
    case .claude: "Runs Claude Code in a folder on this Mac."
    case .openclaw: "Sends briefs to your OpenClaw agent."
    case .hermes: "Runs Hermes Agent in a folder on this Mac."
    case .grok: "Sends briefs to the Grok Bot adapter on your relay."
    case .custom: "A command on this Mac or an HTTPS endpoint you run."
    }
  }
  var symbol: String {
    switch self {
    case .codex: "terminal"
    case .claude: "sparkles"
    case .openclaw: "bolt.horizontal"
    case .hermes: "staroflife"
    case .grok: "cloud"
    case .custom: "square.stack.3d.up"
    }
  }
  var tint: Color {
    switch self {
    case .claude: Color(red: 0.83, green: 0.47, blue: 0.34)
    case .openclaw: .red
    case .hermes: Color(red: 0.52, green: 0.38, blue: 0.74)
    default: Color.accentColor
    }
  }
  static func forHarness(_ h: LocalHarness) -> AgentBrand {
    if h.kind == "webhook" { return h.name.lowercased().contains("grok") ? .grok : .custom }
    return AgentBrand(rawValue: h.kind) ?? .custom
  }
  func harness(service: String) -> LocalHarness {
    var h = LocalHarness()
    h.name = self == .custom ? "My agent" : name
    h.kind = self == .grok || self == .custom ? "webhook" : rawValue
    h.command = h.kind == "webhook" ? "" : ExecutableLocator.find(rawValue)
    if self == .grok, let base = AppConfiguration.validService(service) {
      h.url = URL(string: "/v1/adapters/grokbot/tasks", relativeTo: base)?.absoluteString ?? ""
    }
    return h
  }
}

/// Brand tile. Stays light in both appearances because the bundled marks are dark glyphs.
struct AgentIcon: View {
  var brand: AgentBrand
  var size: CGFloat = 28
  var body: some View {
    ZStack {
      RoundedRectangle(cornerRadius: size * 0.27, style: .continuous).fill(Color.white.opacity(0.92))
      RoundedRectangle(cornerRadius: size * 0.27, style: .continuous).fill(brand.tint.opacity(0.09))
      if brand == .hermes {
        Text("☤").font(.system(size: size * 0.7)).foregroundStyle(brand.tint)
      } else if brand == .custom {
        Image(systemName: "square.stack.3d.up").font(.system(size: size * 0.47)).foregroundStyle(brand.tint)
      } else {
        Image("Harness-\(brand.rawValue)").resizable().scaledToFit()
          .frame(width: size * 0.60, height: size * 0.60)
      }
    }
    .frame(width: size, height: size)
    .overlay(RoundedRectangle(cornerRadius: size * 0.27, style: .continuous).strokeBorder(.black.opacity(0.08)))
    .accessibilityHidden(true)
  }
}

enum MenuBarIcon {
  static func image(for state: ConnectorState) -> NSImage {
    let name: String
    switch state.iconVariant {
    case .running: name = "MenuBarMark"
    case .paused: name = "MenuBarMarkPaused"
    case .alert: name = "MenuBarMarkAlert"
    }
    if let image = NSImage(named: name) {
      image.isTemplate = true
      return image
    }
    let fallback = NSImage(systemSymbolName: "phone.arrow.up.right", accessibilityDescription: "Telegate Connect")!
    fallback.isTemplate = true
    return fallback
  }
}

enum Clipboard {
  static func copy(_ value: String) {
    NSPasteboard.general.clearContents()
    NSPasteboard.general.setString(value, forType: .string)
  }
}

/// A copy button that confirms with "Copied" for two seconds.
struct CopyButton: View {
  var value: String
  var label: String
  var symbol = "doc.on.doc"
  var bordered = false
  var iconOnly = false
  @State private var copied = false
  var body: some View {
    Group {
      if bordered { button.buttonStyle(.bordered) } else { button.buttonStyle(.borderless) }
    }
    .help(label)
    .accessibilityLabel(label)
    .accessibilityValue(copied ? "Copied" : "")
  }
  private var button: some View {
    Button {
      Clipboard.copy(value)
      copied = true
      Task {
        try? await Task.sleep(for: .seconds(2))
        copied = false
      }
    } label: {
      if iconOnly && !copied {
        Label(label, systemImage: symbol).labelStyle(.iconOnly)
      } else {
        Label(copied ? "Copied" : label, systemImage: copied ? "checkmark" : symbol).labelStyle(.titleAndIcon)
      }
    }
  }
}

/// View-layer router shared by every scene.
@MainActor final class ConnectUI: ObservableObject {
  /// One router for every scene; the main window keeps its exact identity (see ConnectApp).
  static let shared = ConnectUI()
  enum Sheet: String, Identifiable {
    case addAgent
    var id: String { rawValue }
  }
  enum SettingsTab: String { case general, connection, advanced }
  @Published var sheet: Sheet?
  @Published var editing: LocalHarness?
  @Published var selectedAgentID: String?
  @Published var confirmRepair = false
  @Published var confirmRemoveID: String?
  @Published var savedNotice: String?
  @Published var focusService = false
  @Published var settingsTab: SettingsTab = SettingsTab(rawValue: UserDefaults.standard.string(forKey: "settingsTab") ?? "") ?? .general {
    didSet { UserDefaults.standard.set(settingsTab.rawValue, forKey: "settingsTab") }
  }
  /// A sheet or dialog is up on the main window; macOS presents one at a time, so hold new ones.
  var isPresenting: Bool { sheet != nil || editing != nil || confirmRepair || confirmRemoveID != nil }
  var openWindow: ((String) -> Void)?
  var openSettings: (() -> Void)?
  /// The main window, recorded by ConnectView. The main WindowGroup has no scene id
  /// (giving it one stops the window presenting at launch on macOS 26), so it is
  /// shown again through AppKit and re-created through SwiftUI's Dock-reopen path.
  weak var mainWindow: NSWindow?
  private var noticeTask: Task<Void, Never>?

  func didSave(_ model: ConnectModel) {
    savedNotice = model.restarting ? "Saved · connector restarted" : "Saved"
    noticeTask?.cancel()
    noticeTask = Task {
      try? await Task.sleep(for: .seconds(3))
      if !Task.isCancelled { savedNotice = nil }
    }
  }
  func togglePauseResume(_ model: ConnectModel) {
    if model.connected { model.stop() } else { model.start() }
  }
  func openMain() {
    NSApp.activate(ignoringOtherApps: true)
    if let window = mainWindow ?? NSApp.windows.first(where: { $0.title == "Telegate Connect" && $0.isVisible }) {
      window.makeKeyAndOrderFront(nil)
      return
    }
    // AppKit released the window: SwiftUI's own File > New Window creates a fresh one.
    let items = NSApp.mainMenu?.items.compactMap(\.submenu).flatMap(\.items) ?? []
    if let item = items.first(where: { $0.title == "New Window" }), let menu = item.menu {
      menu.performActionForItem(at: menu.index(of: item))
    }
  }
  func openActivity() {
    openWindow?("activity")
    NSApp.activate(ignoringOtherApps: true)
  }
  func showSettings(tab: SettingsTab? = nil) {
    if let tab { settingsTab = tab }
    NSApp.activate(ignoringOtherApps: true)
    openSettings?()
  }
}

/// Hands the hosting NSWindow to whoever needs it, without touching the scene identity.
struct WindowReader: NSViewRepresentable {
  var onWindow: (NSWindow?) -> Void
  func makeNSView(context: Context) -> NSView {
    let view = NSView()
    DispatchQueue.main.async { onWindow(view.window) }
    return view
  }
  func updateNSView(_ view: NSView, context: Context) {
    DispatchQueue.main.async { onWindow(view.window) }
  }
}
