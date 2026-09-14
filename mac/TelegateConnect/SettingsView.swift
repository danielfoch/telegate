import AppKit
import SwiftUI

struct SettingsView: View {
  @EnvironmentObject var model: ConnectModel
  @EnvironmentObject var ui: ConnectUI
  var body: some View {
    TabView(selection: $ui.settingsTab) {
      GeneralTab().tabItem { Label("General", systemImage: "gear") }.tag(ConnectUI.SettingsTab.general)
      ConnectionTab().tabItem { Label("Connection", systemImage: "antenna.radiowaves.left.and.right") }.tag(ConnectUI.SettingsTab.connection)
      AdvancedTab().tabItem { Label("Advanced", systemImage: "wrench.and.screwdriver") }.tag(ConnectUI.SettingsTab.advanced)
    }
    .frame(width: 520)
  }
}

private struct SavedCaption: View {
  @EnvironmentObject var ui: ConnectUI
  var body: some View {
    if let notice = ui.savedNotice { Text(notice).foregroundStyle(.secondary) }
  }
}

struct GeneralTab: View {
  @EnvironmentObject var model: ConnectModel
  @EnvironmentObject var ui: ConnectUI
  @State private var nameDraft = ""
  @State private var seeded = false
  @State private var inlineError: String?

  private var version: String {
    let short = Bundle.main.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "0"
    let build = Bundle.main.object(forInfoDictionaryKey: "CFBundleVersion") as? String ?? "0"
    return "\(short) (\(build))"
  }

  var body: some View {
    Form {
      Section {
        Toggle("Open Telegate Connect at login", isOn: Binding(get: { model.launchAtLogin }, set: { model.setLaunchAtLogin($0) }))
      } footer: {
        Text("Connect opens at login and starts the connector if this Mac is paired.")
      }
      Section {
        HStack {
          TextField("Name", text: $nameDraft, prompt: Text("My Mac")).onSubmit(commitName).disabled(model.pair != nil)
          Button("Apply") { commitName() }.disabled(nameDraft.trimmingCharacters(in: .whitespaces) == model.name || model.pair != nil)
        }
        if let inlineError { Text(inlineError).font(.caption).foregroundStyle(.red) }
      } header: { Text("This Mac") } footer: {
        VStack(alignment: .leading, spacing: 2) {
          Text("Shown in the phone’s Computers list; the connector sends it on its next check-in." + (model.pair != nil ? " Finish or cancel pairing to change this." : ""))
          SavedCaption()
        }
      }
      Section("About") {
        LabeledContent("Version") { Text(version) }
        Link("Telegate Connect Help", destination: ConnectStyle.readme)
        Link("Report a problem", destination: ConnectStyle.issues)
      }
    }
    .formStyle(.grouped)
    .frame(height: 390)
    .onAppear { if !seeded { nameDraft = model.name; seeded = true } }
    .onChange(of: model.name) { _, value in nameDraft = value }
  }

  private func commitName() {
    let trimmed = nameDraft.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else { inlineError = "Give this Mac a name."; return }
    let previous = model.name
    model.name = trimmed
    do {
      try model.save(requireService: false)
      model.error = nil
      inlineError = nil
      ui.didSave(model)
    } catch {
      model.name = previous
      inlineError = error.localizedDescription
    }
  }
}

struct ConnectionTab: View {
  @EnvironmentObject var model: ConnectModel
  @EnvironmentObject var ui: ConnectUI
  @State private var serviceDraft = ""
  @State private var seeded = false
  @State private var inlineError: String?
  @State private var confirmUnpair = false
  @State private var confirmRepair = false
  @FocusState private var serviceFocused: Bool

  private var normalizedDraft: String { AppConfiguration.normalizedService(serviceDraft) ?? serviceDraft.trimmingCharacters(in: .whitespacesAndNewlines) }
  private var pairStatus: String {
    if model.pair != nil { return "Pairing…" }
    guard model.deviceId != nil else { return "Not paired" }
    if model.credentialProblem != nil { return "Paired (token missing)" }
    return model.connected ? "Paired · connector running" : "Paired"
  }

  var body: some View {
    Form {
      Section {
        TextField("Address", text: $serviceDraft, prompt: Text("https://relay.example.com"))
          .font(.system(.body, design: .monospaced))
          .textContentType(.URL).autocorrectionDisabled()
          .focused($serviceFocused)
          .onSubmit(commitService)
          .disabled(model.pair != nil)
        HStack {
          if model.validServiceURL != nil {
            CopyButton(value: AppConfiguration.normalizedService(model.service) ?? model.service, label: "Copy address")
          }
          Spacer()
          Button("Apply") { commitService() }.buttonStyle(.borderedProminent)
            .disabled(normalizedDraft == model.service || model.pair != nil)
        }
      } header: { Text("Relay") } footer: {
        VStack(alignment: .leading, spacing: 2) {
          if let inlineError {
            Text(inlineError).foregroundStyle(.red)
          } else if model.pair != nil {
            Text("Finish or cancel pairing to change this.")
          } else if model.isTunnelAddress {
            Text("Temporary tunnel address. It can change when the tunnel restarts; update it here and in the phone’s Settings. Use a permanent host for everyday use.").foregroundStyle(.orange)
          } else {
            Text("Enter the same address in the phone app. Your pairing stays valid if the same relay answers at a new address.")
          }
          SavedCaption()
        }
      }
      Section {
        LabeledContent("Status") { Text(pairStatus) }
        HStack {
          if model.pair != nil {
            Button("Cancel Pairing") { model.resetPairing() }
          } else if model.deviceId != nil {
            Button("Re-pair…") { confirmRepair = true }
              .modifier(ProminentIf(model.credentialProblem != nil))
              .disabled(model.stopping || model.restarting)
            Button("Unpair…", role: .destructive) { confirmUnpair = true }
              .disabled(model.stopping || model.restarting)
          } else {
            Button("Pair with Phone…") {
              ui.openMain()
              Task { await model.beginPairing() }
            }
            .buttonStyle(.borderedProminent).disabled(model.validServiceURL == nil)
          }
        }
      } header: { Text("Pairing") } footer: {
        Text("Unpair only when moving this Mac to a different relay or account.")
      }
      Section {
        Label("Your OpenAI key stays on your phone. Voice goes to OpenAI from the phone. This Mac only receives the tasks you send.", systemImage: "lock.shield")
          .font(.caption).foregroundStyle(.secondary)
      }
    }
    .formStyle(.grouped)
    .frame(height: 480)
    .onAppear {
      if !seeded { serviceDraft = model.service; seeded = true }
      consumeFocusRequest()
    }
    .onChange(of: ui.focusService) { _, wanted in if wanted { consumeFocusRequest() } }
    .onChange(of: model.service) { _, value in serviceDraft = value }
    .confirmationDialog("Re-pair this Mac?", isPresented: $confirmRepair, titleVisibility: .visible) {
      Button("Re-pair") { model.repair(); ui.openMain() }
      Button("Cancel", role: .cancel) {}
    } message: {
      Text("Your phone will need the new code. The old pairing is forgotten.")
    }
    .confirmationDialog("Unpair this Mac?", isPresented: $confirmUnpair, titleVisibility: .visible) {
      Button("Unpair", role: .destructive) { model.unpair() }
      Button("Cancel", role: .cancel) {}
    } message: {
      Text("The connector stops and this Mac forgets its pairing. The computer stays listed on your phone until you disconnect it there.")
    }
  }

  /// Focus the address field once the Settings window is key (the request may arrive before or after appear).
  private func consumeFocusRequest() {
    guard ui.focusService else { return }
    ui.focusService = false
    DispatchQueue.main.async { serviceFocused = true }
  }

  private func commitService() {
    let previous = model.service
    model.service = normalizedDraft
    do {
      try model.save()
      model.error = nil
      model.restart()
      inlineError = nil
      ui.didSave(model)
    } catch {
      model.service = previous
      inlineError = error.localizedDescription
    }
  }
}

private struct ProminentIf: ViewModifier {
  var prominent: Bool
  init(_ prominent: Bool) { self.prominent = prominent }
  func body(content: Content) -> some View {
    if prominent { content.buttonStyle(.borderedProminent) } else { content }
  }
}

struct AdvancedTab: View {
  @EnvironmentObject var model: ConnectModel
  @EnvironmentObject var ui: ConnectUI
  @State private var nodeDraft = ""
  @State private var seeded = false
  @State private var inlineError: String?

  private var nodeOK: Bool { FileManager.default.isExecutableFile(atPath: nodeDraft) }

  var body: some View {
    Form {
      Section {
        LabeledContent("Executable") {
          HStack {
            TextField("", text: $nodeDraft).font(.system(.body, design: .monospaced)).labelsHidden().onSubmit(commitNode)
            Button("Choose…") { chooseNode() }.accessibilityLabel("Choose Node.js executable")
          }
        }
        Label(nodeOK ? "Node.js found at this path." : "No executable at this path.", systemImage: nodeOK ? "checkmark.circle" : "xmark.circle")
          .font(.caption).foregroundStyle(nodeOK ? Color.secondary : Color.red)
        HStack {
          Link("Install Node.js 24 or newer", destination: URL(string: "https://nodejs.org/en/download")!)
          Spacer()
          Button("Apply") { commitNode() }.disabled(nodeDraft == model.node)
        }
      } header: { Text("Node.js") } footer: {
        VStack(alignment: .leading, spacing: 2) {
          if let inlineError { Text(inlineError).foregroundStyle(.red) } else { Text("Node.js 24 or newer runs the connector.") }
          SavedCaption()
        }
      }
      Section {
        LabeledContent("Location") {
          Text(model.configURL.path).font(.caption.monospaced()).lineLimit(1).truncationMode(.middle).textSelection(.enabled)
        }
        Button("Reveal in Finder") { NSWorkspace.shared.activateFileViewerSelecting([model.configURL]) }
      } header: { Text("Configuration file") } footer: {
        Text("Holds this Mac’s pairing token and agent settings. Keep it private.")
      }
    }
    .formStyle(.grouped)
    .frame(height: 400)
    .onAppear { if !seeded { nodeDraft = model.node; seeded = true } }
    .onChange(of: model.node) { _, value in nodeDraft = value }
  }

  private func chooseNode() {
    let panel = NSOpenPanel()
    panel.canChooseFiles = true
    panel.canChooseDirectories = false
    panel.showsHiddenFiles = true
    panel.directoryURL = URL(fileURLWithPath: "/opt/homebrew/bin")
    let handler: (NSApplication.ModalResponse) -> Void = { response in
      if response == .OK, let url = panel.url { nodeDraft = url.path; commitNode() }
    }
    if let window = NSApp.keyWindow { panel.beginSheetModal(for: window, completionHandler: handler) }
    else { handler(panel.runModal()) }
  }

  private func commitNode() {
    let previous = model.node
    model.node = nodeDraft
    do {
      try model.save(requireService: false)
      model.error = nil
      inlineError = nil
      model.restart()
      ui.didSave(model)
    } catch {
      model.node = previous
      inlineError = error.localizedDescription
    }
  }
}
