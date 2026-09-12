import AppIntents
import SwiftUI

@main struct TelegateApp: App {
  @UIApplicationDelegateAdaptor(TelegateAppDelegate.self) private var appDelegate
  @StateObject private var model = AppModel.shared
  @Environment(\.scenePhase) private var phase
  init() { TelegateShortcuts.updateAppShortcutParameters() }
  var body: some Scene {
    WindowGroup {
      Group {
        #if DEBUG
          if ProcessInfo.processInfo.arguments.contains("--dashboard-preview") {
            DashboardDesignPreview()
          } else {
            RootView()
          }
        #else
          RootView()
        #endif
      }.environmentObject(model).tint(Palette.ink)
        .onOpenURL { url in
          if url.scheme == "telegate" && url.host == "call" { model.requestShortcut() }
        }
        .onChange(of: model.shortcutRequested) { _, requested in
          if requested && phase == .active { Task { await model.consumeShortcut() } }
        }
        .onChange(of: phase) { _, phase in
          if phase == .active {
            Task {
              try? await model.refresh()
              await model.consumeShortcut()
            }
          }
        }
        .task {
          try? await model.refresh()
          await model.consumeShortcut()
        }
    }
  }
}
enum Palette {
  static let ink = Color(red: 0.08, green: 0.13, blue: 0.16)
  static let paper = Color(red: 0.96, green: 0.97, blue: 0.94)
  static let mint = Color(red: 0.68, green: 0.95, blue: 0.56)
}
struct RootView: View {
  @EnvironmentObject var model: AppModel
  var body: some View {
    Group {
      if model.login == nil || !model.hasKey {
        OnboardingView()
      } else {
        TabView(selection: $model.tab) {
          DashboardView().tabItem { Label("Dashboard", systemImage: "sun.max.fill") }.tag(4)
          CallView(voice: model.voice).tabItem { Label("Call", systemImage: "phone.fill") }.tag(0)
          ComputersView().tabItem { Label("Computers", systemImage: "laptopcomputer") }.tag(1)
          TasksView().tabItem { Label("Tasks", systemImage: "checklist") }.tag(2)
          SettingsView().tabItem { Label("Settings", systemImage: "slider.horizontal.3") }.tag(3)
        }
        .task {
          while !Task.isCancelled {
            try? await Task.sleep(for: .seconds(5))
            guard !Task.isCancelled else { return }
            try? await model.refresh()
          }
        }
      }
    }
    .preferredColorScheme(.light)
    .sheet(item: $model.presentedTask) { task in
      NavigationStack {
        TaskDetail(task: task).toolbar { Button("Close") { model.presentedTask = nil } }
      }
    }
  }
}
struct Brand: View {
  var body: some View {
    HStack(spacing: 10) {
      Image(systemName: "phone.arrow.up.right.fill").font(.title2).padding(12).background(
        Palette.mint, in: RoundedRectangle(cornerRadius: 15))
      Text("telegate").font(.system(size: 32, weight: .bold, design: .rounded)).tracking(-1)
    }.foregroundStyle(Palette.ink)
  }
}
struct OnboardingView: View {
  @EnvironmentObject var model: AppModel
  @State private var username = ""
  @State private var password = ""
  @State private var key = ""
  @State private var recovery = ""
  @State private var invitation = ""
  @State private var service = AppConfiguration.service
  @State private var mode = "register"
  @State private var busy = false
  @State private var error: String?
  @State private var recoveryToSave: String?
  var body: some View {
    NavigationStack {
      ScrollView {
        VStack(alignment: .leading, spacing: 24) {
          Brand().padding(.top, 24)
          Text(model.login == nil ? "More life.\nLess screen." : "Bring your own voice key.")
            .font(.system(size: 38, weight: .bold, design: .rounded)).fixedSize(
              horizontal: false, vertical: true)
          Text(
            model.login == nil
              ? "Get work done. Get your day back. Talk through an idea, send it to your agents, and leave your desk behind."
              : "Telegate connects directly to OpenAI using your key. It stays in this iPhone’s Keychain. OpenAI bills voice and brief preparation to your account."
          ).foregroundStyle(.secondary)
          if model.login == nil {
            Picker("Account", selection: $mode) {
              Text("Create account").tag("register")
              Text("Sign in").tag("login")
              Text("Recover").tag("recover")
            }.pickerStyle(.segmented)
            VStack(spacing: 16) {
              TextField("Account name", text: $username).textContentType(.username)
                .textInputAutocapitalization(.never).autocorrectionDisabled()
              SecureField(
                mode == "recover" ? "New password (12+ characters)" : "Password (12+ characters)",
                text: $password
              ).textContentType(mode == "login" ? .password : .newPassword)
              if mode == "recover" { SecureField("Recovery key", text: $recovery) }
              if mode == "register" {
                SecureField("Pilot invitation code, if provided", text: $invitation)
              }
            }.padding(20).background(.white, in: RoundedRectangle(cornerRadius: 20))
            DisclosureGroup("Service address") {
              TextField("HTTPS address from your administrator", text: $service).keyboardType(.URL)
                .textInputAutocapitalization(.never).autocorrectionDisabled()
              Text(
                "For the pilot, use the same Telegate service address on your phone and computer."
              ).font(.caption).foregroundStyle(.secondary)
            }
            Button {
              Task { await authenticate() }
            } label: {
              buttonLabel(
                mode == "register"
                  ? "Create my account" : mode == "login" ? "Sign in" : "Recover account")
            }.disabled(busy || username.isEmpty || password.isEmpty)
          } else {
            SecureField("OpenAI project API key", text: $key).textInputAutocapitalization(.never)
              .autocorrectionDisabled().padding(20).background(
                .white, in: RoundedRectangle(cornerRadius: 20))
            Link(
              "Create an OpenAI API key ↗",
              destination: URL(string: "https://platform.openai.com/api-keys")!)
            Text(
              "Your project needs access to GPT-Live and GPT-5.6 Terra. A ChatGPT subscription does not supply this key."
            ).font(.footnote).foregroundStyle(.secondary)
            Button {
              Task {
                busy = true
                defer { busy = false }
                do {
                  try await model.saveKey(key)
                  key = ""
                } catch { self.error = error.localizedDescription }
              }
            } label: {
              buttonLabel("Connect voice")
            }.disabled(busy || key.isEmpty)
          }
          if let error { Text(error).foregroundStyle(.red).accessibilityLabel("Error: \(error)") }
          Text("Next: pair your computers, choose your agents, and start talking.").font(.footnote)
            .foregroundStyle(.secondary)
        }.padding(24).frame(maxWidth: 560).frame(maxWidth: .infinity)
      }.background(Palette.paper)
        .sheet(
          isPresented: Binding(
            get: { recoveryToSave != nil }, set: { if !$0 { recoveryToSave = nil } })
        ) {
          VStack(alignment: .leading, spacing: 24) {
            Text("Save your recovery key").font(.title.bold())
            Text("Keep this somewhere private. You’ll need it if you forget your password.")
            Text(recoveryToSave ?? "").font(.system(.body, design: .monospaced)).textSelection(
              .enabled)
            ShareLink(item: recoveryToSave ?? "") {
              Label("Save recovery key", systemImage: "square.and.arrow.up")
            }
            Button("I’ve saved it") { recoveryToSave = nil }.buttonStyle(.borderedProminent)
          }.padding(30).interactiveDismissDisabled()
        }
    }
  }
  func buttonLabel(_ title: String) -> some View {
    HStack {
      if busy { ProgressView() }
      Text(title).font(.headline)
      Spacer()
      Image(systemName: "arrow.right")
    }.padding(20).foregroundStyle(Palette.ink).background(
      Palette.mint, in: RoundedRectangle(cornerRadius: 18))
  }
  func authenticate() async {
    busy = true
    error = nil
    defer { busy = false }
    guard AppConfiguration.validService(service) != nil else {
      error = "Enter the HTTPS service address supplied for this build."
      return
    }
    UserDefaults.standard.set(service, forKey: "serviceURL")
    do {
      recoveryToSave = try await model.authenticate(
        username: username, password: password, mode: mode, invitation: invitation,
        recoveryKey: recovery)
      password = ""
      recovery = ""
    } catch { self.error = error.localizedDescription }
  }
}
struct CallView: View {
  @EnvironmentObject var model: AppModel
  @ObservedObject var voice: VoiceSession
  var body: some View {
    NavigationStack {
      ScrollView {
        VStack(alignment: .leading, spacing: 24) {
          Brand()
          HStack {
            Label(
              voice.state == .live ? "VOICE CONNECTED" : "VOICE DELEGATION",
              systemImage: "circle.fill"
            ).font(.caption.weight(.semibold)).foregroundStyle(
              voice.state == .live ? Color.green : .secondary)
            Spacer()
            if voice.state != .idle {
              Text(String(format: "%02d:%02d", voice.elapsed / 60, voice.elapsed % 60))
                .monospacedDigit()
            }
          }
          Text(voice.state == .live ? "I’m listening." : "Talk it through.\nGet your day back.")
            .font(
              .system(size: 38, weight: .bold, design: .rounded)
            ).fixedSize(horizontal: false, vertical: true)
          if voice.state == .idle {
            Text(
              "Your connected computer does the work. We’ll let you know when it’s ready if notifications are enabled."
            ).foregroundStyle(.secondary)
          }
          VStack(alignment: .leading, spacing: 10) {
            Text("SEND WORK TO").font(.caption.weight(.semibold)).foregroundStyle(.secondary)
            if model.targets.isEmpty {
              Button("Add your first computer") { model.tab = 1 }
            } else {
              Picker("Destination", selection: $model.selection) {
                ForEach(model.targets) { t in Text(t.label).tag(t.id) }
              }.pickerStyle(.menu).labelsHidden().disabled(voice.state != .idle || model.busy)
              if let d = model.workspace.devices.first(where: {
                $0.id == model.targets.first(where: { $0.id == model.selection })?.deviceId
              }) {
                Label(
                  d.online ? "Online · ready for work" : "Offline · work waits in its queue",
                  systemImage: d.online ? "checkmark.circle.fill" : "clock"
                ).font(.footnote).foregroundStyle(d.online ? Color.green : .secondary)
              }
            }
          }.padding(20).frame(maxWidth: .infinity, alignment: .leading).background(
            .white, in: RoundedRectangle(cornerRadius: 22))
          if let message = model.error ?? voice.error {
            VStack(alignment: .leading, spacing: 8) {
              Text(message).foregroundStyle(.red)
              if message.contains("Microphone") {
                Button("Open iPhone Settings") {
                  UIApplication.shared.open(URL(string: UIApplication.openSettingsURLString)!)
                }
              }
            }.font(.callout)
          }
          if let notice = model.notice { Text(notice).font(.callout).foregroundStyle(.secondary) }
          if model.busy {
            Label("Preparing your brief…", systemImage: "ellipsis.bubble").foregroundStyle(
              .secondary)
          }
          if voice.transcript.isEmpty {
            Text("“Ask Codex on my Mac mini to improve the mobile layout.”").font(.title3)
              .foregroundStyle(.secondary).padding(.vertical, 8)
          } else {
            ForEach(voice.transcript) { line in
              VStack(alignment: .leading, spacing: 6) {
                Text(line.role == "user" ? "YOU" : "TELEGATE").font(.caption2.bold())
                  .foregroundStyle(.secondary)
                Text(line.text).textSelection(.enabled)
              }.padding(16).frame(maxWidth: .infinity, alignment: .leading).background(
                line.role == "user" ? Color.white : Palette.mint.opacity(0.3),
                in: RoundedRectangle(cornerRadius: 16))
            }
          }
        }.padding(24).frame(maxWidth: 650).frame(maxWidth: .infinity)
      }.background(Palette.paper)
        .safeAreaInset(edge: .bottom) {
          VStack(spacing: 8) {
            Text(
              voice.state == .ending
                ? "Finishing the call…" : "Ending a call keeps submitted work running."
            ).font(.caption).foregroundStyle(.secondary)
            Button {
              if voice.state == .idle { Task { await model.startVoice() } } else { voice.end() }
            } label: {
              HStack(spacing: 14) {
                Image(systemName: voice.state == .idle ? "phone.fill" : "phone.down.fill")
                Text(
                  voice.state == .idle
                    ? "Start talking"
                    : voice.state == .connecting ? "Cancel connection" : "End call")
              }.font(.system(size: 26, weight: .bold, design: .rounded)).frame(
                maxWidth: .infinity, minHeight: 96
              ).background(
                voice.state == .idle ? Palette.mint : Color(red: 0.88, green: 0.25, blue: 0.16),
                in: RoundedRectangle(cornerRadius: 28)
              ).foregroundStyle(voice.state == .idle ? Palette.ink : .white)
            }.disabled(voice.state == .ending || (voice.state == .idle && model.busy))
              .accessibilityHint(
                voice.state == .idle
                  ? "Starts a voice conversation"
                  : "Stops microphone capture and ends this conversation")
          }.padding(.horizontal, 20).padding(.vertical, 12).background(.regularMaterial)
        }
    }
  }
}
struct ComputersView: View {
  @EnvironmentObject var model: AppModel
  @State private var adding = false
  @State private var code = ""
  @State private var preview: PairPreview?
  @State private var error: String?
  @State private var busy = false
  @State private var revoke: Computer?
  var body: some View {
    NavigationStack {
      List {
        if model.workspace.devices.isEmpty {
          ContentUnavailableView(
            "Your computers, one call away", systemImage: "laptopcomputer",
            description: Text(
              "Open Telegate Connect on a computer, add your harnesses, then enter its pairing code here."
            ))
        }
        ForEach(model.workspace.devices) { d in
          Section {
            HStack {
              Image(systemName: d.platform == "darwin" ? "desktopcomputer" : "laptopcomputer")
              Text(d.name).font(.headline)
              Spacer()
              Text(d.online ? "Online" : "Offline").font(.caption).foregroundStyle(
                d.online ? .green : .secondary)
            }
            ForEach(d.harnesses) { h in
              HStack {
                Label(h.name, systemImage: "terminal")
                Spacer()
                Text(h.enabled ? "Ready" : "Unavailable").font(.caption).foregroundStyle(.secondary)
              }
            }
            NavigationLink("Project awareness") { ProjectAwarenessView(computerID: d.id) }
            Button("Disconnect computer", role: .destructive) { revoke = d }
          } footer: {
            Text(
              "Configure executables, folders, and permissions on this computer in Telegate Connect."
            )
          }
        }
      }.navigationTitle("Computers").toolbar {
        Button {
          adding = true
          preview = nil
          code = ""
          error = nil
        } label: {
          Image(systemName: "plus")
        }.accessibilityLabel("Add computer")
      }
      .refreshable { try? await model.refresh() }
      .confirmationDialog(
        "Disconnect \(revoke?.name ?? "this computer")?",
        isPresented: Binding(get: { revoke != nil }, set: { if !$0 { revoke = nil } }),
        titleVisibility: .visible
      ) {
        Button("Disconnect", role: .destructive) {
          if let d = revoke {
            Task {
              do { try await model.revoke(d) } catch { model.error = error.localizedDescription }
            }
          }
        }
      } message: {
        Text(
          "Queued work is cancelled. An active run stops when the connector receives the revocation; check the computer for work already performed."
        )
      }
      .sheet(isPresented: $adding) {
        NavigationStack {
          Form {
            Section("Code shown on your computer") {
              TextField("ABCDE-12345", text: $code).textInputAutocapitalization(.characters)
                .autocorrectionDisabled().font(.title2.monospaced())
              Button("Find computer") { Task { await find() } }.disabled(busy || code.isEmpty)
            }
            if let preview {
              Section("Confirm this is your computer") {
                Label(preview.name, systemImage: "laptopcomputer")
                Text(preview.platform)
                ForEach(preview.harnesses) { Text($0.name) }
                Button("Connect this computer") { Task { await approve() } }.disabled(busy)
              }
            }
            if let error { Text(error).foregroundStyle(.red) }
          }.navigationTitle("Add computer").toolbar { Button("Close") { adding = false } }
        }
      }
    }
  }
  func find() async {
    busy = true
    error = nil
    preview = nil
    defer { busy = false }
    do {
      let value = code.replacingOccurrences(of: "-", with: "").replacingOccurrences(
        of: " ", with: "")
      guard value.count == 10, value.allSatisfy({ $0.isHexDigit }) else {
        throw UserFacingError(message: "Enter the 10-character code from Telegate Connect.")
      }
      preview = try await model.api.request("/v1/pair/preview?code=\(value)")
    } catch { self.error = error.localizedDescription }
  }
  func approve() async {
    busy = true
    error = nil
    defer { busy = false }
    do {
      let _: OK = try await model.api.request("/v1/pair/approve", body: ["code": code])
      try await model.refresh()
      adding = false
    } catch { self.error = error.localizedDescription }
  }
}
struct ProjectAwarenessView: View {
  @EnvironmentObject var model: AppModel
  var computerID: String
  @State private var error: String?
  @State private var busy = false
  var computer: Computer? { model.workspace.devices.first { $0.id == computerID } }
  let intervals: [(Int, String)] = [
    (0, "Manual only"), (5, "Every 5 minutes"), (15, "Every 15 minutes"), (30, "Every 30 minutes"),
    (60, "Every hour"), (180, "Every 3 hours"), (360, "Every 6 hours"), (720, "Every 12 hours"),
    (1440, "Daily"),
  ]
  var body: some View {
    Form {
      if let computer {
        Section("Refresh schedule") {
          Picker(
            "Scan frequency",
            selection: Binding(
              get: { computer.scanMinutes }, set: { value in update(computer, minutes: value) })
          ) { ForEach(intervals, id: \.0) { value in Text(value.1).tag(value.0) } }.disabled(busy)
          Button(computer.scanRequested ? "Scan requested — waiting for computer" : "Scan now") {
            update(computer, now: true)
          }.disabled(busy || computer.scanRequested)
          if let at = computer.scannedAt {
            LabeledContent("Last scan") {
              Text(Date(timeIntervalSince1970: at / 1000), style: .relative)
            }
          } else {
            Text("No project scan received yet.").foregroundStyle(.secondary)
          }
          Text(
            "The schedule runs in Telegate Connect while this computer is awake. Missed scans are refreshed after reconnecting. No OpenAI call is needed for the scan; your voice and brief-preparation calls use the context with your own key."
          ).font(.footnote).foregroundStyle(.secondary)
        }
        Section("Shared projects") {
          if computer.projects.isEmpty {
            Text(
              "On this computer, enable ‘Share project context’ for the harness folders you want Telegate to know about."
            ).foregroundStyle(.secondary)
          }
          ForEach(computer.projects) { p in
            VStack(alignment: .leading, spacing: 8) {
              Text(p.name).font(.headline)
              if let branch = p.branch { Label(branch, systemImage: "arrow.triangle.branch") }
              if let n = p.changedFiles { Text("\(n) changed file\(n==1 ? "":"s")") }
              if let commit = p.latestCommit {
                Text(commit).font(.callout).foregroundStyle(.secondary)
              }
              if p.status != "ready" {
                Text(
                  p.status == "not_git"
                    ? "Folder shared · no Git project detected" : "Project scan unavailable"
                ).font(.caption).foregroundStyle(.secondary)
              }
            }.padding(.vertical, 6)
          }
        }
        Section {
          Text(
            "Telegate reads only the folders you opt into on this computer. It shares project names, branches, change counts, and the latest commit subject—not source files or diffs. A snapshot shows recent activity, not an inventory of every project on the machine."
          ).font(.footnote)
        }
      }
      if let error { Text(error).foregroundStyle(.red) }
    }.navigationTitle("Project awareness").navigationBarTitleDisplayMode(.inline).refreshable {
      try? await model.refresh()
    }
  }
  func update(_ computer: Computer, minutes: Int? = nil, now: Bool = false) {
    Task {
      busy = true
      defer { busy = false }
      do {
        try await model.scan(computer, minutes: minutes, now: now)
        error = nil
      } catch { self.error = error.localizedDescription }
    }
  }
}
struct TasksView: View {
  @EnvironmentObject var model: AppModel
  @State private var error: String?
  var body: some View {
    NavigationStack {
      List {
        if !model.pending.isEmpty {
          Section("Saved on this phone · delivery unconfirmed") {
            ForEach(model.pending) { Text($0.title) }
            Button("Retry delivery") {
              Task {
                do {
                  try await model.flushPending()
                  error = nil
                } catch { self.error = error.localizedDescription }
              }
            }
          }
        }
        if model.workspace.tasks.isEmpty && model.pending.isEmpty {
          ContentUnavailableView(
            "Your delegated work", systemImage: "checklist",
            description: Text(
              "Ask Telegate to assign a task during a call. Its brief and delivery status will appear here."
            ))
        }
        if let error { Text(error).foregroundStyle(.red) }
        ForEach(model.workspace.tasks) { task in
          NavigationLink {
            TaskDetail(task: task)
          } label: {
            VStack(alignment: .leading, spacing: 8) {
              Text(task.title).font(.headline)
              HStack {
                Text(task.status.replacingOccurrences(of: "_", with: " ").capitalized).font(
                  .caption.bold())
                Spacer()
                Text(Date(timeIntervalSince1970: task.createdAt / 1000), style: .relative).font(
                  .caption
                ).foregroundStyle(.secondary)
              }
              Text(
                model.workspace.devices.first { $0.id == task.deviceId }?.name
                  ?? "Disconnected computer"
              ).font(.caption).foregroundStyle(.secondary)
            }
          }
        }
      }.navigationTitle("Tasks").refreshable { try? await model.refresh() }
    }
  }
}
struct TaskDetail: View {
  @EnvironmentObject var model: AppModel
  @Environment(\.dismiss) private var dismiss
  let task: DelegatedTask
  @State private var error: String?
  var latest: DelegatedTask { model.workspace.tasks.first { $0.id == task.id } ?? task }
  var body: some View {
    ScrollView {
      VStack(alignment: .leading, spacing: 20) {
        Text(latest.title).font(.title.bold())
        Text(latest.status.replacingOccurrences(of: "_", with: " ").capitalized).font(.headline)
        Text(latest.prompt).textSelection(.enabled)
        if !latest.result.isEmpty {
          Divider()
          Text(latest.result).textSelection(.enabled)
        }
        if let id = latest.runId {
          Text("Harness session: \(id)").font(.caption.monospaced()).textSelection(.enabled)
        }
        if let s = latest.threadURL, let url = URL(string: s),
          ["https", "codex"].contains(url.scheme)
        {
          Link("Open in harness", destination: url)
        }
        followupButtons
        HStack {
          if latest.status == "draft" {
            Button("Send task") { action("send") }.buttonStyle(.borderedProminent)
          }
          if ["draft", "queued"].contains(latest.status) {
            Button("Cancel task", role: .destructive) { action("cancel") }.buttonStyle(.bordered)
          }
        }
        if let error { Text(error).foregroundStyle(.red) }
      }.padding(24)
    }.navigationTitle("Task").navigationBarTitleDisplayMode(.inline)
  }
  func action(_ value: String) {
    Task {
      do { try await model.taskAction(latest, value) } catch {
        self.error = error.localizedDescription
      }
    }
  }
  @ViewBuilder var followupButtons: some View {
    if ["completed", "failed", "needs_attention"].contains(latest.status) {
      Button("Read it to me", systemImage: "speaker.wave.2.fill") { continueVoice(read: true) }
      Button("Continue by voice", systemImage: "phone.fill") { continueVoice(read: false) }
    }
  }
  func continueVoice(read: Bool) {
    let task = latest
    model.presentedTask = nil
    model.tab = 0
    dismiss()
    Task { await model.startVoice(followup: task, readSummary: read) }
  }
}
struct SettingsView: View {
  @EnvironmentObject var model: AppModel
  @State private var key = ""
  @State private var password = ""
  @State private var error: String?
  @State private var busy = false
  @State private var deleting = false
  var body: some View {
    NavigationStack {
      Form {
        Section("Delegation") {
          Toggle("Send when I ask", isOn: $model.autoSend).disabled(
            model.voice.state != .idle || model.busy)
          Text(
            "When off, Telegate prepares drafts for you to review in Tasks. When on, a clear request to delegate queues the brief automatically."
          ).font(.footnote).foregroundStyle(.secondary)
        }
        Section("Action Button") {
          Label("Start voice chat", systemImage: "button.programmable")
          Text(
            "On an iPhone with an Action Button: open Settings → Action Button → Shortcut → Choose a Shortcut → Telegate → Start voice chat."
          )
          Text(
            "Complete onboarding and allow the microphone first. The shortcut opens Telegate and starts a call with your selected destination. iPhone may ask you to unlock. You can also run it from Shortcuts or Siri."
          ).font(.footnote).foregroundStyle(.secondary)
          Button("Try the shortcut action") { model.requestShortcut() }
        }
        Section("OpenAI key") {
          Text(
            "Saved in this phone’s Keychain. Audio and conversation go directly to OpenAI; Telegate’s relay receives task briefs and results."
          ).font(.footnote)
          SecureField("Replacement API key", text: $key)
          Button("Verify and replace key") {
            Task {
              busy = true
              defer { busy = false }
              do {
                try await model.saveKey(key)
                key = ""
                error = nil
              } catch { self.error = error.localizedDescription }
            }
          }.disabled(key.isEmpty || busy || model.voice.state != .idle)
        }
        Section("Account") {
          Text(model.login?.username ?? "")
          Text(AppConfiguration.service).font(.caption).textSelection(.enabled)
          Button("Sign out") {
            Task {
              do { try await model.signOut() } catch { self.error = error.localizedDescription }
            }
          }.disabled(busy || model.busy)
          Button("Delete account", role: .destructive) { deleting = true }.disabled(model.busy)
        }
        Section("Completion notifications") {
          Text(model.notificationStatus).font(.callout)
          Button(model.notificationsEnabled ? "Turn off notifications" : "Enable notifications") {
            Task {
              if model.notificationsEnabled {
                await model.disableNotifications()
              } else {
                await model.enableNotifications()
              }
            }
          }
        }
        Section("Privacy") {
          Text(
            "Your OpenAI key stays on this device. Telegate stores your account, paired computers, task briefs, and harness results. It doesn’t upload recordings to the relay. Disconnecting a computer revokes its access. Deleting your account deletes its relay data; existing work and logs in your harness remain on that computer."
          ).font(.footnote)
        }
        if let error { Text(error).foregroundStyle(.red) }
      }.navigationTitle("Settings").onChange(of: model.autoSend) { _, value in
        UserDefaults.standard.set(value, forKey: "autoSend")
      }
      .sheet(isPresented: $deleting) {
        NavigationStack {
          Form {
            Text(
              "Delete your account, paired computers, and saved tasks from Telegate. This cannot undo work already performed in a harness."
            )
            SecureField("Your password", text: $password)
            Button("Permanently delete account", role: .destructive) {
              Task {
                busy = true
                defer { busy = false }
                do {
                  try await model.deleteAccount(password: password)
                  password = ""
                  deleting = false
                } catch { self.error = error.localizedDescription }
              }
            }.disabled(password.isEmpty || busy)
            if let error { Text(error).foregroundStyle(.red) }
          }.navigationTitle("Delete account").toolbar {
            Button("Cancel") {
              deleting = false
              password = ""
            }
          }
        }
      }
    }
  }
}
