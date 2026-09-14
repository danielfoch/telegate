#if DEBUG
  import AppKit
  import SwiftUI

  // Design review only: `--render-preview <screen> <file.png> [--dark]` renders the real
  // window (or its sheet / the Settings or Activity window) shortly after launch, writes a
  // PNG, and exits. Fixtures live in memory: the connector never starts and nothing is saved.
  @MainActor enum DesignPreviewCapture {
    static var requested: (screen: String, path: String)? {
      let arguments = CommandLine.arguments
      guard let index = arguments.firstIndex(of: "--render-preview"), index + 2 < arguments.count
      else { return nil }
      return (arguments[index + 1], arguments[index + 2])
    }
    static var dark: Bool { CommandLine.arguments.contains("--dark") }
    private static var started = false
    static func begin() -> Bool {
      if started { return false }
      started = true
      return true
    }

    static func capture(screen: String, to path: String, model: ConnectModel, ui: ConnectUI) async {
      if dark { NSApp.appearance = NSAppearance(named: .darkAqua) }
      // Controls draw desaturated in an inactive app; previews should look like the real thing.
      NSApp.activate(ignoringOtherApps: true)
      let main = NSApp.windows.first { $0.title == "Telegate Connect" }
      main?.makeKeyAndOrderFront(nil)
      if screen.hasPrefix("settings") { ui.openSettings?() }
      if screen == "activity" { ui.openWindow?("activity") }
      try? await Task.sleep(for: .seconds(1.8))
      func isChrome(_ w: NSWindow) -> Bool {
        String(describing: type(of: w)).contains("StatusBar") || w is NSPanel || !w.isVisible
      }
      let target: NSView?
      switch screen {
      case "menubar":
        let host = NSHostingView(rootView: MenuBarPreview().environmentObject(model).environmentObject(ui))
        host.frame = NSRect(x: 0, y: 0, width: 300, height: 420)
        host.layoutSubtreeIfNeeded()
        target = host
      case "activity":
        try? await Task.sleep(for: .seconds(1.5))
        let w = NSApp.windows.first { $0.title == "Activity" }
        w?.makeKeyAndOrderFront(nil)
        w?.contentView?.layoutSubtreeIfNeeded()
        w?.displayIfNeeded()
        target = w?.contentView?.superview ?? w?.contentView
      case "activity-host":
        let host = NSHostingView(rootView: ActivityView().environmentObject(model).environmentObject(ui).frame(width: 640, height: 420))
        host.frame = NSRect(x: 0, y: 0, width: 640, height: 420)
        host.layoutSubtreeIfNeeded()
        target = host
      case let s where s.hasPrefix("settings"):
        let w = NSApp.windows.first { !isChrome($0) && $0.title != "Telegate Connect" && $0.title != "Activity" }
        w?.makeKeyAndOrderFront(nil)
        target = w?.contentView?.superview ?? w?.contentView
      case "main-reopen", "main-reopen-scene", "main-reopen-late":
        // Close the window, then bring it back the way the menu bar item does. The `-scene`
        // variant forces the fallback for a window AppKit has already released.
        let closed = main.map { ObjectIdentifier($0) }
        main?.close()
        try? await Task.sleep(for: .milliseconds(700))
        guard !(NSApp.windows.contains { $0.title == "Telegate Connect" && $0.isVisible }) else { exit(5) }
        switch screen {
        case "main-reopen-scene":
          ui.mainWindow = nil  // pretend AppKit released it: exercises the New Window fallback
          ui.openMain()
        case "main-reopen-late":
          try? await Task.sleep(for: .seconds(5))
          FileHandle.standardError.write("late: uiMain=\(ui.mainWindow != nil) windows=\(NSApp.windows.filter { !isChrome($0) || $0.title == "Telegate Connect" }.map { "\($0.title):\($0.isVisible)" })\n".data(using: .utf8)!)
          ui.openMain()
        default:
          ui.openMain()
        }
        try? await Task.sleep(for: .seconds(2))
        guard let w = NSApp.windows.first(where: { $0.title == "Telegate Connect" && $0.isVisible }) else { exit(4) }
        FileHandle.standardError.write("reopen: sameWindow=\(closed == ObjectIdentifier(w)) state=\(model.connectorState) windows=\(NSApp.windows.filter { !isChrome($0) }.map(\.title))\n".data(using: .utf8)!)
        w.contentView?.layoutSubtreeIfNeeded()
        target = w.contentView?.superview ?? w.contentView
      case let s where s.hasPrefix("editor") || s == "add":
        target = main?.attachedSheet?.contentView?.superview ?? main?.attachedSheet?.contentView
      default:
        target = main?.contentView?.superview ?? main?.contentView
      }
      try? await Task.sleep(for: .milliseconds(300))
      guard let view = target, let rep = view.bitmapImageRepForCachingDisplay(in: view.bounds) else { exit(2) }
      view.cacheDisplay(in: view.bounds, to: rep)
      do {
        try rep.representation(using: .png, properties: [:])?.write(to: URL(fileURLWithPath: path))
        exit(0)
      } catch { exit(3) }
    }
  }

  /// Menu contents rendered as a plain list so they can be captured off screen.
  private struct MenuBarPreview: View {
    var body: some View {
      VStack(alignment: .leading, spacing: 6) { MenuBarContent() }
        .buttonStyle(.plain).padding(12).frame(width: 300, alignment: .leading)
        .background(Color(nsColor: .windowBackgroundColor))
    }
  }

  @MainActor enum PreviewFixture {
    static let sampleLog = """
      Connector started. Waiting for work.
      Paired computer 6d25203d… checked in (Codex, Claude Code).
      Heartbeat every 15 s.
      Task 4f1c received for Codex · ~/Projects/telegate-test
      Codex started (auto review).
      Codex finished in 2m 14s · result 1.2 KB
      Result delivered.
      Heartbeat every 15 s.

      """

    static func apply(_ screen: String, model: ConnectModel, ui: ConnectUI) {
      let now = Date().timeIntervalSince1970
      switch screen {
      case "main", "main-reopen", "main-reopen-scene", "main-reopen-late": model.connected = true
      case "main-setup": model.service = ""; model.deviceId = nil
      case "main-unpaired": model.deviceId = nil
      case "main-pairing": model.pair = Pairing(id: "preview", code: "1234567890", expiresAt: (now + 582) * 1000)
      case "main-paused": model.deviceId = "preview"; model.connected = false; model.credentialProblem = nil
      case "main-noagents":
        model.deviceId = "preview"; model.connected = false
        for i in model.harnesses.indices { model.harnesses[i].enabled = false }
      case "main-repair":
        model.deviceId = "preview"; model.connected = false
        model.credentialProblem = "the earlier build stored it in the macOS keychain and it can’t be read (item not found)"
      case "main-error":
        model.deviceId = "preview"; model.connected = false
        model.error = "Connector stopped. Check Activity; if the computer was revoked, pair again."
      case "main-restarting": model.deviceId = "preview"; model.restarting = true
      case "main-checked":
        model.connected = true
        model.checkedHarnesses = model.harnesses.enumerated().map { index, h in
          Harness(id: h.id, name: h.name, kind: h.kind, enabled: index != 2, problem: index == 1 ? "codex not found on this Mac" : nil)
        }
        model.checkMessage = "Service reachable · 2 agents available. Send a small test task from your phone to verify agent sign-in, then test a file edit to confirm permissions."
      case "main-empty": model.harnesses = []; model.deviceId = nil
      case "editor": ui.editing = model.harnesses.first ?? AgentBrand.codex.harness(service: model.service)
      case "editor-openclaw": ui.editing = AgentBrand.openclaw.harness(service: model.service)
      case "editor-webhook": ui.editing = AgentBrand.grok.harness(service: model.service)
      case "editor-custom": ui.editing = AgentBrand.custom.harness(service: model.service)
      case "add": ui.sheet = .addAgent
      case "settings-general": ui.settingsTab = .general
      case "settings-connection": ui.settingsTab = .connection
      case "settings-advanced": ui.settingsTab = .advanced
      case "activity", "activity-host": model.log = sampleLog; model.connected = true
      case "menubar": model.connected = true
      default: break
      }
    }
  }
#endif
