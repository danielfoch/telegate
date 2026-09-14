import AppKit
import SwiftUI

struct AgentEditor: View {
  @EnvironmentObject var model: ConnectModel
  @EnvironmentObject var ui: ConnectUI
  @Environment(\.dismiss) private var dismiss
  @State private var draft: LocalHarness
  @State private var error: String?
  @State private var advanced: Bool
  @State private var confirmRemove = false
  private let original: LocalHarness

  init(original: LocalHarness) {
    self.original = original
    _draft = State(initialValue: original)
    _advanced = State(initialValue:
      original.command != ExecutableLocator.find(original.kind)
      || !original.args.isEmpty
      || (original.agentId ?? "main") != "main")
  }

  private var isNew: Bool { !model.harnesses.contains { $0.id == original.id } }
  private var brand: AgentBrand { .forHarness(draft) }
  private var isLocal: Bool { draft.kind != "webhook" }
  private var isGrok: Bool { draft.name.lowercased().contains("grok") }

  var body: some View {
    VStack(spacing: 0) {
      HStack(spacing: 12) {
        AgentIcon(brand: brand, size: 36)
        VStack(alignment: .leading, spacing: 2) {
          Text(isNew ? "Add \(brand.name)" : draft.name).font(.title3.weight(.semibold))
          Text(brand.detailSentence).font(.callout).foregroundStyle(.secondary)
        }
        Spacer()
      }
      .padding(.horizontal, 20).padding(.top, 20).padding(.bottom, 12)

      Form {
        Section {
          TextField("Name", text: $draft.name)
          if brand == .custom {
            Picker("Connection", selection: $draft.kind) {
              Text("HTTPS endpoint").tag("webhook")
              Text("Local command").tag("command")
            }
            .pickerStyle(.segmented)
          }
        }
        if isLocal {
          Section {
            LabeledContent("Folder") {
              HStack {
                Text((draft.cwd as NSString).abbreviatingWithTildeInPath)
                  .lineLimit(1).truncationMode(.middle).foregroundStyle(.secondary)
                Button("Choose…") { chooseFolder() }.accessibilityLabel("Choose folder")
              }
            }
            Toggle("Share project context with the phone", isOn: $draft.shareProjectContext)
          } header: { Text("Runs in") } footer: {
            VStack(alignment: .leading, spacing: 4) {
              Text("Sends the folder name, branch, change count and latest commit subject so your briefs can refer to them. Source files stay on this Mac.")
              if draft.kind == "openclaw" {
                Text("Work runs in your OpenClaw agent’s own workspace. This folder is only used for project context.")
              }
            }
          }
          if ["codex", "claude"].contains(draft.kind) {
            Section {
              Picker("Approvals", selection: $draft.approvalMode) {
                Text("Automatic review").tag("auto")
                if draft.kind == "claude" { Text("File edits only").tag("edits") }
                Text("Full access, no sandbox").tag("bypass")
              }
              .pickerStyle(.menu)
            } header: { Text("Approvals") } footer: {
              Text(approvalNote).foregroundStyle(draft.approvalMode == "bypass" ? .orange : .secondary)
            }
          }
          Section {
            DisclosureGroup("Advanced", isExpanded: $advanced) {
              TextField("Executable", text: $draft.command).font(.system(.body, design: .monospaced))
              if draft.kind == "openclaw" {
                TextField("Agent ID", text: Binding(get: { draft.agentId ?? "main" }, set: { draft.agentId = $0 }), prompt: Text("main"))
              }
              if draft.kind == "command" {
                TextField("Arguments, one per line", text: Binding(
                  get: { draft.args.joined(separator: "\n") },
                  set: { draft.args = $0.components(separatedBy: "\n") }), axis: .vertical)
                  .lineLimit(2...6)
                Text("The brief is sent on standard input.").font(.caption).foregroundStyle(.secondary)
              }
              LabeledContent("Time limit") {
                Stepper("\(draft.timeoutMinutes) min", value: $draft.timeoutMinutes, in: 15...1440, step: 15).monospacedDigit()
              }
            }
          } footer: {
            Text("Uses the agent’s own account, model and permissions. Install and sign in to it first.")
          }
        } else {
          Section {
            TextField("URL", text: $draft.url, prompt: Text("https://…/tasks"))
              .textContentType(.URL).font(.system(.body, design: .monospaced))
            SecureField("Key", text: $draft.token)
            Link("Endpoint guide", destination: URL(string: "https://github.com/danielfoch/telegate/blob/main/docs/\(isGrok ? "integrations/GROKBOT.md" : "API.md")")!)
          } header: { Text("Endpoint") } footer: {
            Text(isGrok
                 ? "Use the Grok Bot adapter address and key from your relay administrator. Results arrive in Tasks on your phone."
                 : "Your endpoint must accept Telegate task submissions and post results back. Results appear in Tasks on your phone.")
          }
        }
      }
      .formStyle(.grouped)

      if let error {
        Text(error).font(.callout).foregroundStyle(.red).textSelection(.enabled)
          .frame(maxWidth: .infinity, alignment: .leading).padding(.horizontal, 20).padding(.bottom, 8)
      }
      HStack(spacing: 8) {
        if !isNew {
          Button("Remove…", role: .destructive) { confirmRemove = true }.buttonStyle(.borderless)
            .accessibilityLabel("Remove \(draft.name)")
        }
        Spacer()
        if model.connected {
          Text("The connector picks this up on its next check-in.")
            .font(.caption).foregroundStyle(.secondary).lineLimit(2).multilineTextAlignment(.trailing)
        }
        Button("Cancel") { dismiss() }.keyboardShortcut(.cancelAction)
        Button(isNew ? "Add" : "Save") { commit() }
          .buttonStyle(.borderedProminent).keyboardShortcut(.defaultAction)
        Button("") { commit() }.keyboardShortcut("s").hidden().frame(width: 0, height: 0)
      }
      .padding(20)
    }
    .frame(width: 520, height: 600)
    .confirmationDialog("Remove \(draft.name)?", isPresented: $confirmRemove, titleVisibility: .visible) {
      Button("Remove", role: .destructive) { commit(remove: true) }
      Button("Cancel", role: .cancel) {}
    } message: {
      Text("Your phone will no longer offer this agent. Nothing on disk is deleted.")
    }
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

  private func chooseFolder() {
    let panel = NSOpenPanel()
    panel.canChooseDirectories = true
    panel.canChooseFiles = false
    panel.canCreateDirectories = true
    panel.directoryURL = URL(fileURLWithPath: draft.cwd)
    let handler: (NSApplication.ModalResponse) -> Void = { response in
      if response == .OK, let url = panel.url { draft.cwd = url.path }
    }
    if let window = NSApp.keyWindow { panel.beginSheetModal(for: window, completionHandler: handler) }
    else { handler(panel.runModal()) }
  }

  private func commit(remove: Bool = false) {
    var draft = self.draft
    draft.args = draft.args.filter { !$0.trimmingCharacters(in: .whitespaces).isEmpty }
    let message = model.applyAgents { list in
      let index = list.firstIndex { $0.id == draft.id }
      list.removeAll { $0.id == draft.id }
      if !remove {
        if let index { list.insert(draft, at: index) } else { list.append(draft) }
      }
    }
    if let message { error = message } else { ui.didSave(model); dismiss() }
  }
}

struct AddAgentSheet: View {
  @EnvironmentObject var model: ConnectModel
  @EnvironmentObject var ui: ConnectUI
  @Environment(\.dismiss) private var dismiss
  @State private var selected: AgentBrand?

  var body: some View {
    VStack(spacing: 0) {
      Text("Add Agent").font(.title3.weight(.semibold))
        .frame(maxWidth: .infinity, alignment: .leading).padding(20)
      List(AgentBrand.allCases, selection: $selected) { brand in
        HStack(spacing: 12) {
          AgentIcon(brand: brand, size: 28)
          VStack(alignment: .leading, spacing: 1) {
            Text(brand.name).font(.body.weight(.medium))
            Text(brand.detailSentence).font(.caption).foregroundStyle(.secondary)
          }
          Spacer()
          if model.harnesses.contains(where: { AgentBrand.forHarness($0) == brand }) {
            Text("Added").font(.caption2.weight(.medium)).foregroundStyle(.tertiary)
          }
        }
        .tag(brand)
        .contentShape(Rectangle())
        .simultaneousGesture(TapGesture(count: 2).onEnded { choose(brand) })
        .accessibilityLabel("\(brand.name), \(brand.detailSentence)")
      }
      .listStyle(.inset)
      Divider()
      HStack {
        Spacer()
        Button("Cancel") { dismiss() }.keyboardShortcut(.cancelAction)
        Button("Continue") { if let selected { choose(selected) } }
          .buttonStyle(.borderedProminent).keyboardShortcut(.defaultAction).disabled(selected == nil)
      }
      .padding(12)
    }
    .frame(width: 420, height: 400)
  }

  private func choose(_ brand: AgentBrand) {
    let harness = brand.harness(service: model.service)
    dismiss()
    Task {
      try? await Task.sleep(for: .milliseconds(80))
      ui.editing = harness
    }
  }
}
