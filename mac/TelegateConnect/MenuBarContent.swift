import AppKit
import SwiftUI

struct MenuBarContent: View {
  @EnvironmentObject var model: ConnectModel
  @EnvironmentObject var ui: ConnectUI
  @Environment(\.openWindow) private var openWindow

  private func openMain() { ui.openMain() }

  var body: some View {
    let state = model.connectorState
    Text(model.menuTitle)
    Text(model.name).font(.caption)
    if let pair = model.pair {
      TimelineView(.periodic(from: .now, by: 1)) { context in
        let remaining = max(0, Int(pair.expiresAt / 1000 - context.date.timeIntervalSince1970))
        Text("Code \(pair.code.prefix(5))-\(pair.code.suffix(5)) · expires in \(remaining / 60):\(String(format: "%02d", remaining % 60))")
      }
    }
    if let error = model.error { Text("Error: " + error.prefix(60)) }
    Divider()
    switch state {
    case .running: Button(model.stopping ? "Pausing…" : "Pause Connector") { model.stop() }.disabled(model.stopping || model.busy)
    case .paused: Button("Resume Connector") { model.start() }
    case .noAgents: Button("Resume Connector") {}.disabled(true)
    case .notPaired: Button("Pair Phone…") { openMain(); Task { await model.beginPairing() } }
    case .needsService: Button("Set Relay Address…") { ui.showSettings(tab: .connection) }
    case .credentialProblem: Button("Re-pair This Mac…") { openMain(); ui.confirmRepair = true }.disabled(ui.isPresenting)
    case .pairing:
      Button("Copy Pairing Code") { if let code = model.pair?.code { Clipboard.copy(code) } }
      Button("Cancel Pairing") { model.resetPairing() }
    case .restarting: Button("Restarting…") {}.disabled(true)
    }
    Menu("Agents") {
      if model.harnesses.isEmpty { Text("No agents yet") }
      ForEach(model.harnesses) { harness in
        Toggle(harness.name, isOn: Binding(get: { harness.enabled }, set: { value in
          guard let index = model.harnesses.firstIndex(where: { $0.id == harness.id }) else { return }
          if model.applyAgents({ $0[index].enabled = value }) == nil { ui.didSave(model) }
        }))
        .accessibilityLabel("Use \(harness.name)")
      }
      Divider()
      Button("Add Agent…") { openMain(); ui.sheet = .addAgent }.disabled(ui.isPresenting)
    }
    Divider()
    if model.validServiceURL != nil {
      Button("Copy Service Address") { Clipboard.copy(AppConfiguration.normalizedService(model.service) ?? model.service) }
    }
    Button("Check Setup") { Task { await model.checkSetup() } }.disabled(model.checking || model.pair != nil)
    Divider()
    Button("Open Telegate Connect") { openMain() }
    Button("Show Activity") { openWindow(id: "activity"); NSApp.activate(ignoringOtherApps: true) }
    SettingsLink { Text("Settings…") }
    Divider()
    Button("Quit Telegate Connect") { NSApp.terminate(nil) }
  }
}

struct ConnectCommands: Commands {
  @ObservedObject var model: ConnectModel
  @ObservedObject var ui: ConnectUI

  var body: some Commands {
    // Keep SwiftUI's New Window (⌘N): it is also how a released main window comes back.
    CommandGroup(after: .newItem) {
      Button("Add Agent…") { ui.openMain(); ui.sheet = .addAgent }.keyboardShortcut("n", modifiers: [.command, .shift])
        .disabled(ui.isPresenting)
    }
    CommandMenu("Connector") {
      Button(model.connected ? "Pause Connector" : "Resume Connector") { ui.togglePauseResume(model) }
        .keyboardShortcut("r")
        .disabled(!model.connectorState.canToggle || model.busy || model.stopping)
      Button("Check Setup") { Task { await model.checkSetup() } }
        .keyboardShortcut("k", modifiers: [.command, .shift])
        .disabled(model.checking || model.pair != nil)
      Divider()
      Button("Show Activity") { ui.openActivity() }
        .keyboardShortcut("l", modifiers: [.command, .shift])
      Button("Copy Service Address") { Clipboard.copy(AppConfiguration.normalizedService(model.service) ?? model.service) }
        .keyboardShortcut("c", modifiers: [.command, .shift])
        .disabled(model.validServiceURL == nil)
      Divider()
      Button("Pair Phone…") { ui.openMain(); Task { await model.beginPairing() } }
        .disabled(model.connectorState != .notPaired)
      Button("Re-pair This Mac…") { ui.openMain(); ui.confirmRepair = true }
        .disabled(model.deviceId == nil || ui.isPresenting || model.stopping || model.restarting)
    }
    CommandGroup(replacing: .help) {
      Link("Telegate Connect Help", destination: ConnectStyle.readme)
    }
  }
}
