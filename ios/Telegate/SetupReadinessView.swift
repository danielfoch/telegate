import SwiftUI

struct SetupReadinessView: View {
  @EnvironmentObject var model: AppModel
  private var onlineAgent: Bool {
    model.workspace.devices.contains { $0.online && $0.harnesses.contains(where: \.enabled) }
  }
  var body: some View {
    if onlineAgent && model.hasKey && model.connectionError == nil {
      Button { model.tab = 1 } label: {
        Label("Voice key verified · computer online", systemImage: "checkmark.circle.fill")
          .font(.footnote.weight(.medium)).foregroundStyle(.secondary)
          .frame(maxWidth: 632, alignment: .leading)
      }.buttonStyle(.plain).frame(maxWidth: .infinity)
    } else {
    VStack(alignment: .leading, spacing: 14) {
      Text(onlineAgent && model.hasKey && model.connectionError == nil ? "Your next idea is ready to go." : "Let’s get you ready.")
        .font(.headline)
      if let error = model.connectionError {
        Label(error, systemImage: "wifi.exclamationmark").font(.callout).foregroundStyle(.red)
        Text("Showing the last received state. Pull to refresh before sending work.")
          .font(.caption).foregroundStyle(.secondary)
      }
      row("Voice key", detail: model.hasKey ? "Verified on this iPhone" : "Add your OpenAI key in Settings", ready: model.hasKey) { model.tab = 3 }
      row("Computer & agent", detail: onlineAgent ? "Online and available" : model.targets.isEmpty ? "Pair a computer and enable an agent" : "Offline · new work will wait", ready: onlineAgent) { model.tab = 1 }
      Button("Send a small test task", systemImage: "paperplane") {
        model.tab = 2
        model.composingTask = true
      }
        .font(.callout.weight(.semibold)).disabled(model.targets.isEmpty)
      Text("A completed test confirms this agent’s sign-in and permissions. Voice needs a separate first-call check.")
        .font(.caption).foregroundStyle(.secondary)
    }.padding(20).frame(maxWidth: 632, alignment: .leading)
      .background(.white, in: RoundedRectangle(cornerRadius: 22)).frame(maxWidth: .infinity)
    }
  }
  private func row(_ title: String, detail: String, ready: Bool, action: @escaping () -> Void) -> some View {
    Button(action: action) {
      HStack(spacing: 12) {
        Image(systemName: ready ? "checkmark.circle.fill" : "circle.dashed")
          .foregroundStyle(ready ? Color.green : Color.secondary)
        VStack(alignment: .leading, spacing: 3) {
          Text(title).font(.subheadline.weight(.semibold))
          Text(detail).font(.caption).foregroundStyle(.secondary)
        }
        Spacer()
        Image(systemName: "chevron.right").font(.caption).foregroundStyle(.secondary)
      }.contentShape(Rectangle())
    }.buttonStyle(.plain)
  }
}

struct NewTaskView: View {
  @EnvironmentObject var model: AppModel
  @Environment(\.dismiss) private var dismiss
  @State private var title = ""
  @State private var prompt = ""
  @State private var destination = ""
  @State private var requestID = UUID().uuidString
  @State private var busy = false
  @State private var error: String?
  var body: some View {
    NavigationStack {
      Form {
        Section("Send work to") {
          Picker("Destination", selection: $destination) {
            ForEach(model.targets) { Text($0.label).tag($0.id) }
          }
          if let selected = model.targets.first(where: { $0.id == destination }) {
            Text(selected.label).font(.footnote).foregroundStyle(.secondary)
              .fixedSize(horizontal: false, vertical: true)
          }
          if let computer = model.workspace.devices.first(where: { destination.hasPrefix($0.id + ":") }), !computer.online {
            Label("This computer is offline. Work waits until it reconnects.", systemImage: "clock")
              .font(.footnote).foregroundStyle(.secondary)
          }
        }
        Section("Your task") {
          TextField("A short title", text: $title)
          TextField("What should your agent do?", text: $prompt, axis: .vertical).lineLimit(6...12)
          Button("Use a connection test") {
            title = "Check my Telegate connection"
            prompt = "This is a connection test. Do not change files, run tools, contact anyone, or start other work. Reply with: Telegate connection confirmed."
          }
        }
        Section {
          Text(model.autoSend ? "This sends real work using your agent’s existing account and permissions. No OpenAI voice key is needed for a text task." : "Send when I ask is off. This will save a draft for you to review and send from Tasks.")
            .font(.footnote).foregroundStyle(.secondary)
        }
        if let error { Text(error).foregroundStyle(.red) }
      }.disabled(busy)
        .navigationTitle("New task").navigationBarTitleDisplayMode(.inline)
        .toolbar {
          ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() }.disabled(busy) }
          ToolbarItem(placement: .confirmationAction) {
            Button(model.autoSend ? "Send" : "Save draft") { Task { await submit() } }
              .disabled(busy || title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || prompt.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || destination.isEmpty)
          }
        }
        .overlay { if busy { ProgressView("Saving your task…").padding(24).background(.regularMaterial, in: RoundedRectangle(cornerRadius: 16)) } }
        .interactiveDismissDisabled(busy)
        .onAppear { destination = model.selection.isEmpty ? model.targets.first?.id ?? "" : model.selection }
    }
  }
  private func submit() async {
    busy = true
    defer { busy = false }
    let before = Set(model.pending.map(\.id))
    do {
      try await model.createTextTask(id: requestID, title: title, prompt: prompt, targetID: destination)
      dismiss()
    } catch {
      // Once queued locally, retry that exact brief from Tasks rather than creating a second job.
      if model.pending.contains(where: { !before.contains($0.id) }) { dismiss() }
      else { self.error = error.localizedDescription }
    }
  }
}
