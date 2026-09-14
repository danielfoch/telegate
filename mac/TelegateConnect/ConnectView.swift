import AppKit
import SwiftUI

struct ConnectView: View {
  @EnvironmentObject var model: ConnectModel
  @ObservedObject private var ui = ConnectUI.shared
  @Environment(\.openWindow) private var openWindow
  @Environment(\.openSettings) private var openSettings

  private var removeBinding: Binding<Bool> {
    Binding(get: { ui.confirmRemoveID != nil }, set: { if !$0 { ui.confirmRemoveID = nil } })
  }
  private var removeName: String {
    model.harnesses.first { $0.id == ui.confirmRemoveID }?.name ?? "agent"
  }

  var body: some View {
    VStack(spacing: 16) {
      ComputerBlock()
      if model.error != nil || model.stopTimedOut { ErrorBanner() }
      AgentsSection()
      Spacer(minLength: 0)
      MainFooter()
    }
    .padding(20)
    .frame(maxWidth: 1000)
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(ConnectStyle.window)
    .background(WindowReader { window in
      if let window, window != ui.mainWindow { ui.mainWindow = window }
    })
    .navigationTitle("Telegate Connect")
    .navigationSubtitle(model.name)
    .toolbar {
      ToolbarItem(placement: .principal) { StatusPill() }
      ToolbarItemGroup(placement: .primaryAction) {
        Button { ui.togglePauseResume(model) } label: {
          if model.stopping || model.restarting {
            Label { Text(model.connected ? "Pause" : "Resume") } icon: { ProgressView().controlSize(.small) }
          } else {
            Label(model.connected ? "Pause" : "Resume", systemImage: model.connected ? "pause.fill" : "play.fill")
          }
        }
        .labelStyle(.titleAndIcon)
        .help("Pause or resume the connector (⌘R)")
        .accessibilityLabel(model.connected ? "Pause connector" : "Resume connector")
        .disabled(!model.connectorState.canToggle || model.busy || model.stopping)
        Menu {
          ForEach(AgentBrand.allCases) { brand in
            Button { ui.editing = brand.harness(service: model.service) } label: {
              Label(brand.name, systemImage: brand.symbol)
            }
          }
        } label: {
          Label("Add Agent", systemImage: "plus")
        }
        .menuIndicator(.visible)
        .help("Add an agent (⇧⌘N)")
        .accessibilityLabel("Add agent")
        SettingsLink { Label("Settings", systemImage: "gearshape") }
          .help("Settings (⌘,)")
          .accessibilityLabel("Settings")
      }
    }
    .sheet(item: $ui.editing) { harness in AgentEditor(original: harness) }
    .sheet(item: $ui.sheet) { _ in AddAgentSheet() }
    .confirmationDialog("Re-pair this Mac?", isPresented: $ui.confirmRepair, titleVisibility: .visible) {
      Button("Re-pair") { model.repair() }
      Button("Cancel", role: .cancel) {}
    } message: {
      Text("Your phone will need the new code. The old pairing is forgotten.")
    }
    .confirmationDialog("Remove \(removeName)?", isPresented: removeBinding, titleVisibility: .visible) {
      Button("Remove", role: .destructive) {
        if let id = ui.confirmRemoveID {
          if model.applyAgents({ $0.removeAll { $0.id == id } }) == nil { ui.didSave(model) }
        }
        ui.confirmRemoveID = nil
      }
      Button("Cancel", role: .cancel) {}
    } message: {
      Text("Your phone will no longer offer this agent. Nothing on disk is deleted.")
    }
    .environmentObject(ui)
    .onAppear {
      ui.openWindow = { openWindow(id: $0) }
      ui.openSettings = { openSettings() }
    }
    .animation(.snappy, value: model.connectorState)
    #if DEBUG
      .task {
        // Once per process, and detached from this view: `main-reopen` recreates the view.
        guard let preview = DesignPreviewCapture.requested, DesignPreviewCapture.begin() else { return }
        PreviewFixture.apply(preview.screen, model: model, ui: ui)
        Task { await DesignPreviewCapture.capture(screen: preview.screen, to: preview.path, model: model, ui: ui) }
      }
    #endif
  }
}

// MARK: - Status pill

struct StatusPill: View {
  @EnvironmentObject var model: ConnectModel
  var body: some View {
    let state = model.connectorState
    HStack(spacing: 6) {
      if state == .restarting {
        ProgressView().controlSize(.mini)
      } else if state == .pairing {
        Image(systemName: "circle.fill").font(.system(size: 8)).foregroundStyle(model.statusColor)
          .symbolEffect(.pulse, isActive: true)
      } else {
        Circle().fill(model.statusColor).frame(width: 8, height: 8)
      }
      Text(state.title).font(.caption.weight(.medium))
    }
    .padding(.horizontal, 10).padding(.vertical, 5)
    .background(Capsule().fill(.quaternary.opacity(0.6)))
    .accessibilityElement(children: .combine)
    .accessibilityLabel("Connector status: \(state.title)")
  }
}

// MARK: - Computer block

struct ComputerBlock: View {
  @EnvironmentObject var model: ConnectModel
  @EnvironmentObject var ui: ConnectUI

  private var isLaptop: Bool { model.name.localizedCaseInsensitiveContains("MacBook") }
  private var address: String { AppConfiguration.normalizedService(model.service) ?? model.service }

  var body: some View {
    let state = model.connectorState
    HStack(alignment: .top, spacing: 14) {
      Image(systemName: isLaptop ? "laptopcomputer" : "desktopcomputer")
        .font(.system(size: 22)).foregroundStyle(Color.accentColor)
        .frame(width: 44, height: 44)
        .background(Color.accentColor.opacity(0.10), in: RoundedRectangle(cornerRadius: 12, style: .continuous))
        .accessibilityHidden(true)
      VStack(alignment: .leading, spacing: 4) {
        Text(model.name).font(.title3.weight(.semibold))
        Text(model.statusSentence).font(.callout).foregroundStyle(.secondary)
          .fixedSize(horizontal: false, vertical: true)
        if state == .pairing, let pair = model.pair {
          PairingPanel(pair: pair).padding(.top, 8)
        } else {
          HStack(spacing: 8) {
            Image(systemName: "network").foregroundStyle(.tertiary).imageScale(.small)
            if state == .needsService {
              Text("No relay address set").font(.callout).foregroundStyle(.secondary)
            } else {
              Text(address).font(.system(.callout, design: .monospaced))
                .lineLimit(1).truncationMode(.middle).textSelection(.enabled)
              CopyButton(value: address, label: "Copy relay address", iconOnly: true)
            }
            SettingsLink { Text("Edit") }.buttonStyle(.link).font(.callout)
              .simultaneousGesture(TapGesture().onEnded { ui.settingsTab = .connection })
              .accessibilityLabel("Edit relay address in Settings")
          }
          .padding(.top, 6)
          if model.isTunnelAddress {
            Label("Temporary tunnel address. It can change when the tunnel restarts; update it here and in the phone’s Settings.", systemImage: "exclamationmark.triangle")
              .font(.caption).foregroundStyle(.orange).fixedSize(horizontal: false, vertical: true)
          }
          if state == .credentialProblem {
            Text("Re-pairing forgets the old pairing and keeps the new token in Connect’s private config file.")
              .font(.caption).foregroundStyle(.secondary).fixedSize(horizontal: false, vertical: true)
          }
        }
      }
      Spacer(minLength: 12)
      primaryControl(state)
    }
    .padding(16)
    .card()
  }

  @ViewBuilder private func primaryControl(_ state: ConnectorState) -> some View {
    switch state {
    case .needsService:
      SettingsLink { Text("Set Relay Address…") }.buttonStyle(.borderedProminent)
        .simultaneousGesture(TapGesture().onEnded { ui.settingsTab = .connection; ui.focusService = true })
    case .notPaired:
      Button {
        Task { await model.beginPairing() }
      } label: {
        if model.busy {
          HStack(spacing: 6) { ProgressView().controlSize(.small); Text("Getting code…") }
        } else {
          Text(model.error == "Pairing expired. Get a new code." ? "Get New Code…" : "Pair Phone…")
        }
      }
      .buttonStyle(.borderedProminent).disabled(model.busy)
    case .credentialProblem:
      Button("Re-pair This Mac") { ui.confirmRepair = true }.buttonStyle(.borderedProminent)
    case .noAgents:
      if model.harnesses.isEmpty {
        Button("Add Agent…") { ui.sheet = .addAgent }.buttonStyle(.borderedProminent)
      }
    case .pairing, .paused, .restarting, .running:
      EmptyView()
    }
  }
}

// MARK: - Pairing panel

struct PairingPanel: View {
  @EnvironmentObject var model: ConnectModel
  var pair: Pairing

  private var formatted: String { String(pair.code.prefix(5)) + "\u{2011}" + String(pair.code.suffix(5)) }
  private var address: String { AppConfiguration.normalizedService(model.service) ?? model.service }

  var body: some View {
    VStack(alignment: .leading, spacing: 10) {
      Text("On your phone: Telegate › Computers › Add Computer, then enter this code.").font(.callout)
      HStack(spacing: 12) {
        Text(formatted)
          .font(.system(size: 28, weight: .semibold, design: .monospaced)).tracking(1.5)
          .textSelection(.enabled)
          .accessibilityLabel("Pairing code " + pair.code.map(String.init).joined(separator: " "))
        CopyButton(value: pair.code, label: "Copy Code", bordered: true)
        Spacer()
        TimelineView(.periodic(from: .now, by: 1)) { context in
          let remaining = max(0, Int(pair.expiresAt / 1000 - context.date.timeIntervalSince1970))
          Text("Expires in \(remaining / 60):\(String(format: "%02d", remaining % 60))")
            .font(.callout.monospacedDigit())
            .foregroundStyle(remaining < 60 ? Color.orange : Color.secondary)
            .contentTransition(.numericText())
            .accessibilityLabel("Expires in \(remaining / 60) minutes \(remaining % 60) seconds")
        }
      }
      HStack(spacing: 8) {
        Image(systemName: "network").foregroundStyle(.tertiary).imageScale(.small)
        Text(address).font(.system(.caption, design: .monospaced)).lineLimit(1).truncationMode(.middle)
        CopyButton(value: address, label: "Copy Relay Address")
        Spacer()
        Button("Cancel") { model.resetPairing() }
      }
      Text(model.isTunnelAddress
           ? "Temporary tunnel address. Enter this exact address on your phone. If it changes after a restart, update it here and on the phone."
           : "Use the same relay address on both devices.")
        .font(.caption).foregroundStyle(model.isTunnelAddress ? Color.orange : Color.secondary)
        .fixedSize(horizontal: false, vertical: true)
    }
    .padding(14)
    .background(Color.accentColor.opacity(0.07), in: RoundedRectangle(cornerRadius: ConnectStyle.panelRadius, style: .continuous))
  }
}

// MARK: - Error banner

struct ErrorBanner: View {
  @EnvironmentObject var model: ConnectModel
  var body: some View {
    if let error = model.error ?? (model.stopTimedOut ? "Connector is still stopping." : nil) {
      HStack(alignment: .firstTextBaseline, spacing: 8) {
        Image(systemName: "exclamationmark.circle.fill").foregroundStyle(.red)
        Text(error).font(.callout).textSelection(.enabled).fixedSize(horizontal: false, vertical: true)
        Spacer()
        if error.localizedCaseInsensitiveContains("Node") || error.localizedCaseInsensitiveContains("service address") {
          SettingsLink { Text("Open Settings") }.buttonStyle(.borderless)
        }
        if model.stopTimedOut {
          Button("Force Stop") { model.forceStop() }.buttonStyle(.borderless)
        }
        if model.error != nil {
          Button("Dismiss") { model.error = nil }.buttonStyle(.borderless).accessibilityLabel("Dismiss error")
        }
      }
      .padding(.horizontal, 12).padding(.vertical, 8)
      .background(.red.opacity(0.08), in: RoundedRectangle(cornerRadius: ConnectStyle.panelRadius, style: .continuous))
      .overlay(RoundedRectangle(cornerRadius: ConnectStyle.panelRadius, style: .continuous).strokeBorder(.red.opacity(0.25)))
      .accessibilityElement(children: .contain)
      .accessibilityLabel("Error: \(error)")
    }
  }
}

// MARK: - Agents

struct AgentsSection: View {
  private var problemRowCount: Int {
    model.harnesses.filter { if case .problem = model.status(for: $0) { return true }; return false }.count
  }
  @EnvironmentObject var model: ConnectModel
  @EnvironmentObject var ui: ConnectUI

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      HStack(spacing: 8) {
        Text("Agents").font(.headline)
        Text("\(model.enabledAgentCount) of \(model.harnesses.count) on").font(.callout).foregroundStyle(.secondary)
        Spacer()
        if let notice = ui.savedNotice {
          Text(notice).font(.caption).foregroundStyle(.secondary).transition(.opacity)
        }
        Button {
          Task { await model.checkSetup() }
        } label: {
          if model.checking { ProgressView().controlSize(.small) } else { Label("Check Setup", systemImage: "checkmark.shield") }
        }
        .controlSize(.small)
        .disabled(model.checking || model.busy || model.pair != nil)
        .help("Check Setup (⇧⌘K)")
        .accessibilityLabel("Check setup")
      }
      caption
      Group {
        if model.harnesses.isEmpty {
          ContentUnavailableView {
            Label("No Agents", systemImage: "cpu")
          } description: {
            Text("Add the agent that should receive work from your phone.")
          } actions: {
            Button("Add Agent…") { ui.sheet = .addAgent }.buttonStyle(.borderedProminent)
          }
          .frame(maxWidth: .infinity, maxHeight: .infinity)
        } else {
          List(selection: $ui.selectedAgentID) {
            ForEach(model.harnesses) { harness in
              AgentRow(harness: harness).tag(harness.id)
            }
            .onMove { from, to in
              model.applyAgents(restartConnector: false) { $0.move(fromOffsets: from, toOffset: to) }
            }
          }
          .listStyle(.inset)
          .scrollContentBackground(.hidden)
          .environment(\.defaultMinListRowHeight, 52)
          .onDeleteCommand { if let id = ui.selectedAgentID { ui.confirmRemoveID = id } }
          .onKeyPress(.return) {
            guard let id = ui.selectedAgentID, let h = model.harnesses.first(where: { $0.id == id }) else { return .ignored }
            ui.editing = h
            return .handled
          }
          .onKeyPress(.space) {
            guard let id = ui.selectedAgentID, let index = model.harnesses.firstIndex(where: { $0.id == id }) else { return .ignored }
            let value = !model.harnesses[index].enabled
            if model.applyAgents({ $0[index].enabled = value }) == nil { ui.didSave(model) }
            return .handled
          }
          // Hug the rows; scroll only when the window is too short for them.
          .frame(maxHeight: CGFloat(model.harnesses.count) * 53 + 10 + CGFloat(problemRowCount) * 18)
        }
      }
      .clipShape(RoundedRectangle(cornerRadius: ConnectStyle.cardRadius, style: .continuous))
      .card()
      .frame(minHeight: model.harnesses.isEmpty ? 220 : 0)
    }
    .animation(.default, value: ui.savedNotice)
  }

  @ViewBuilder private var caption: some View {
    Group {
      if model.checking {
        Text("Checking…")
      } else if let message = model.checkMessage {
        HStack(spacing: 6) {
          Image(systemName: "checkmark.circle").foregroundStyle(Color.accentColor)
          Text(message).lineLimit(2)
          Spacer()
          Button { model.checkMessage = nil } label: { Label("Hide", systemImage: "xmark") }
            .buttonStyle(.borderless).labelStyle(.iconOnly).controlSize(.small)
            .accessibilityLabel("Hide check result")
        }
      } else if model.pair != nil {
        Text("Agents you change now are included after pairing.")
      } else {
        Text("Not checked since the last change.")
      }
    }
    .font(.caption).foregroundStyle(.secondary)
  }
}

struct AgentRow: View {
  @EnvironmentObject var model: ConnectModel
  @EnvironmentObject var ui: ConnectUI
  var harness: LocalHarness
  @State private var hovering = false

  private var brand: AgentBrand { .forHarness(harness) }
  private var abbreviatedFolder: String { (harness.cwd as NSString).abbreviatingWithTildeInPath }
  private var approvalLabel: String {
    switch harness.approvalMode {
    case "edits": "Edits only"
    case "bypass": "Full access"
    default: "Auto review"
    }
  }
  private var detailText: String {
    switch harness.kind {
    case "webhook": URL(string: harness.url)?.host ?? "HTTPS endpoint"
    case "codex", "claude": "\(abbreviatedFolder) · \(approvalLabel)"
    case "openclaw": "\(abbreviatedFolder) · Agent \(harness.agentId ?? "main")"
    case "command": "\(abbreviatedFolder) · \((harness.command as NSString).lastPathComponent)"
    default: abbreviatedFolder
    }
  }
  private var enabledBinding: Binding<Bool> {
    Binding(get: { harness.enabled }, set: { value in
      guard let index = model.harnesses.firstIndex(where: { $0.id == harness.id }) else { return }
      if model.applyAgents({ $0[index].enabled = value }) == nil { ui.didSave(model) }
    })
  }

  var body: some View {
    HStack(spacing: 12) {
      AgentIcon(brand: brand, size: 28).opacity(harness.enabled ? 1 : 0.5)
      VStack(alignment: .leading, spacing: 2) {
        Text(harness.name).font(.body.weight(.medium)).foregroundStyle(harness.enabled ? .primary : .secondary)
        detailLine
      }
      Spacer(minLength: 12)
      checkBadge
      Button("Edit") { ui.editing = harness }
        .buttonStyle(.borderless).font(.callout).opacity(hovering ? 1 : 0)
        .accessibilityLabel("Edit \(harness.name)")
      Toggle("Use \(harness.name)", isOn: enabledBinding)
        .labelsHidden().toggleStyle(.switch).controlSize(.small)
        .help("Restarts the connector if it is running")
    }
    .padding(.vertical, 6)
    .listRowInsets(EdgeInsets(top: 0, leading: 12, bottom: 0, trailing: 12))
    .contentShape(Rectangle())
    .onHover { hovering = $0 }
    .simultaneousGesture(TapGesture(count: 2).onEnded { ui.editing = harness })
    .contextMenu {
      Button("Edit…") { ui.editing = harness }
      Button(harness.enabled ? "Turn Off" : "Turn On") { enabledBinding.wrappedValue.toggle() }
      if harness.kind != "webhook" {
        Button("Reveal Folder in Finder") {
          NSWorkspace.shared.activateFileViewerSelecting([URL(fileURLWithPath: harness.cwd)])
        }
      }
      Divider()
      Button("Remove…", role: .destructive) { ui.confirmRemoveID = harness.id }
    }
    .accessibilityElement(children: .contain)
    .accessibilityLabel("\(harness.name), \(detailText), \(harness.enabled ? "on" : "off")")
    .accessibilityAction(named: "Edit") { ui.editing = harness }
  }

  @ViewBuilder private var detailLine: some View {
    if case .problem(let problem) = model.status(for: harness) {
      Text(problem).font(.caption).foregroundStyle(.orange).lineLimit(2).fixedSize(horizontal: false, vertical: true)
    } else if ["codex", "claude"].contains(harness.kind) {
      (Text(abbreviatedFolder + " · ") + Text(approvalLabel).foregroundColor(harness.approvalMode == "bypass" ? .orange : .secondary))
        .font(.caption).foregroundStyle(.secondary).lineLimit(1).truncationMode(.middle)
    } else {
      Text(detailText).font(.caption).foregroundStyle(.secondary).lineLimit(1).truncationMode(.middle)
    }
  }

  @ViewBuilder private var checkBadge: some View {
    switch model.status(for: harness) {
    case .ready:
      Label("Ready", systemImage: "checkmark.circle.fill").font(.caption).foregroundStyle(Color.accentColor)
    case .problem(let problem):
      Label("Needs attention", systemImage: "exclamationmark.triangle.fill").font(.caption).foregroundStyle(.orange)
        .help(problem).accessibilityValue(problem)
    case .off:
      if model.checkedHarnesses.contains(where: { $0.id == harness.id }) {
        Label("Off", systemImage: "circle").font(.caption).foregroundStyle(.tertiary)
      }
    case .unchecked:
      EmptyView()
    }
  }
}

// MARK: - Footer

struct MainFooter: View {
  @EnvironmentObject var model: ConnectModel
  @EnvironmentObject var ui: ConnectUI

  private var pushFootnote: String {
    "Results appear in Tasks on your phone."
  }
  var body: some View {
    VStack(spacing: 10) {
      Divider()
      HStack(spacing: 12) {
        Toggle("Open at Login", isOn: Binding(get: { model.launchAtLogin }, set: { model.setLaunchAtLogin($0) }))
          .toggleStyle(.checkbox).font(.callout)
        Spacer()
        Text(pushFootnote).font(.caption).foregroundStyle(.secondary).lineLimit(1).truncationMode(.tail)
        Button { ui.openActivity() } label: { Label("Activity", systemImage: "list.bullet.rectangle") }
          .buttonStyle(.borderless).font(.callout)
          .help("Show Activity (⇧⌘L)").accessibilityLabel("Show activity")
        Link("Help", destination: ConnectStyle.readme).font(.callout)
      }
    }
  }
}
