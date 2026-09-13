import SwiftUI

struct DashboardView: View {
  @EnvironmentObject var model: AppModel
  @State private var snapshot: AccountDashboard?
  @State private var error: String?
  var body: some View {
    NavigationStack {
      ScrollView {
        if let snapshot {
          DashboardContent(
            snapshot: snapshot, accountName: model.login?.username ?? "",
            startCall: {
              model.tab = 0
              Task { await model.startVoice() }
            }, preferences: { DashboardPreferencesView(snapshot: snapshot) { self.snapshot = $0 } })
        } else {
          VStack(spacing: 20) {
            Brand()
            Text("More life. Less screen.").font(.largeTitle.bold())
            if error == nil { ProgressView("Loading your progress…") }
          }.padding(24)
        }
        if let error {
          VStack(spacing: 12) {
            Text(error).foregroundStyle(.red)
            Button("Try again") { Task { await refresh() } }
          }.padding()
        }
      }
      .background(Palette.paper)
      .navigationTitle("Your dashboard").navigationBarTitleDisplayMode(.inline)
      .toolbar {
        NavigationLink {
          LeaderboardView()
        } label: {
          Image(systemName: "trophy")
        }.accessibilityLabel("Community leaderboard")
      }
      .task { await refresh() }
      .onChange(of: model.workspace.tasks.map { "\($0.id):\($0.updatedAt)" }) { _, _ in
        Task { await refresh() }
      }
      .refreshable { await refresh() }
    }
  }
  private func refresh() async {
    let owner = model.login?.userId
    do {
      let value: AccountDashboard = try await model.api.request("/v1/dashboard")
      guard owner == model.login?.userId else { return }
      snapshot = value
      error = nil
    } catch { self.error = error.localizedDescription }
  }
}

struct DashboardContent<Preferences: View>: View {
  let snapshot: AccountDashboard
  let accountName: String
  let startCall: () -> Void
  @ViewBuilder let preferences: () -> Preferences
  @State private var recent = false
  private var totals: DashboardTotals { recent ? snapshot.last7Days : snapshot.allTime }
  private var nextMilestone: Int? {
    [1, 10, 25, 50, 100, 250, 500, 1000].first { $0 > snapshot.allTime.tasksCompleted }
  }
  var body: some View {
    VStack(alignment: .leading, spacing: 24) {
      Brand()
      Text("MORE LIFE. LESS SCREEN.").font(.caption.weight(.semibold)).tracking(1.5)
      Text("Get work done.\nGet your day back.")
        .font(.system(size: 38, weight: .bold, design: .rounded))
        .fixedSize(horizontal: false, vertical: true)
      Text("Talk it through. Send it off. Get back to your day.")
        .font(.title3).foregroundStyle(.secondary)
      Button(action: startCall) {
        Label("Start a voice chat", systemImage: "phone.fill")
          .font(.title3.bold()).frame(maxWidth: .infinity, minHeight: 72)
      }.buttonStyle(.plain).background(Palette.ink, in: RoundedRectangle(cornerRadius: 24))
        .foregroundStyle(.white)
      Picker("Time period", selection: $recent) {
        Text("All time").tag(false)
        Text("Last 7 days").tag(true)
      }.pickerStyle(.segmented)
      VStack(alignment: .leading, spacing: 12) {
        Label("Estimated screen time saved", systemImage: "sun.max")
          .font(.headline)
        Text(
          Double(totals.estimatedMinutesSaved) / 60, format: .number.precision(.fractionLength(1))
        )
        .font(.system(size: 64, weight: .bold, design: .rounded)).monospacedDigit()
        .accessibilityLabel(
          "\(Double(totals.estimatedMinutesSaved)/60, specifier: "%.1f") estimated hours saved")
        Text("hours for the rest of your life").font(.title3)
        Text(
          "\(totals.tasksCompleted) completed task\(totals.tasksCompleted == 1 ? "" : "s") × your \(snapshot.preferences.minutesPerCompletedTask)-minute estimate. This is an estimate of hands-on work avoided, not measured time away."
        )
        .font(.footnote).foregroundStyle(Palette.ink.opacity(0.8))
        NavigationLink("How this is estimated", destination: preferences)
          .font(.footnote.bold()).underline()
      }.frame(maxWidth: .infinity, alignment: .leading).padding(24)
        .background(Palette.mint, in: RoundedRectangle(cornerRadius: 28))
      ViewThatFits(in: .horizontal) {
        HStack(alignment: .top, spacing: 12) {
          shipped
          completed
        }
        VStack(spacing: 12) {
          shipped
          completed
        }
      }
      VStack(alignment: .leading, spacing: 14) {
        Text("LIFETIME MILESTONES").font(.caption.bold()).tracking(1.2)
        if let nextMilestone {
          Text("Next milestone: \(nextMilestone) tasks handled.").font(.title3.bold())
          ProgressView(value: Double(snapshot.allTime.tasksCompleted), total: Double(nextMilestone))
            .tint(Palette.ink)
          Text(
            "\(snapshot.allTime.tasksCompleted) of \(nextMilestone) completed. Go at your own pace."
          ).font(.callout).foregroundStyle(.secondary)
        } else {
          Text("1,000+ tasks handled.").font(.title3.bold())
          Text("That’s a lot of work you didn’t have to sit down for.").foregroundStyle(.secondary)
        }
      }.padding(24).frame(maxWidth: .infinity, alignment: .leading)
        .background(.white, in: RoundedRectangle(cornerRadius: 24))
      NavigationLink {
        LeaderboardView()
      } label: {
        HStack(spacing: 16) {
          Image(systemName: "trophy").font(.title2)
          VStack(alignment: .leading, spacing: 4) {
            Text("The away-from-desk leaderboard").font(.headline)
            Text("An optional community. Your work stays private.").font(.footnote)
          }
          Spacer(minLength: 0)
          Image(systemName: "chevron.right")
        }.padding(20).background(.white, in: RoundedRectangle(cornerRadius: 24))
      }.buttonStyle(.plain)
      Text("Account: \(accountName)").font(.caption).foregroundStyle(.secondary)
      Text(
        "Updated \(Date(timeIntervalSince1970: snapshot.asOf/1000), style: .relative) ago. Pull to refresh."
      )
      .font(.caption).foregroundStyle(.secondary)
    }.foregroundStyle(Palette.ink).padding(24)
  }
  private var shipped: some View {
    metric(
      "Prompts shipped", value: totals.promptsShipped, note: "Accepted for delivery, counted once.",
      icon: "paperplane")
  }
  private var completed: some View {
    metric(
      "Work completed", value: totals.tasksCompleted, note: "Reported complete by your harness.",
      icon: "checkmark.circle")
  }
  private func metric(_ title: String, value: Int, note: String, icon: String) -> some View {
    VStack(alignment: .leading, spacing: 10) {
      Image(systemName: icon).font(.title2)
      Text(value, format: .number).font(.system(size: 36, weight: .bold, design: .rounded))
        .monospacedDigit()
      Text(title).font(.headline)
      Text(note).font(.caption).foregroundStyle(.secondary)
    }.frame(minWidth: 120, maxWidth: .infinity, alignment: .leading)
      .padding(20).background(.white, in: RoundedRectangle(cornerRadius: 24))
  }
}

struct DashboardPreferencesView: View {
  @EnvironmentObject var model: AppModel
  @Environment(\.dismiss) private var dismiss
  @State private var minutes: Int
  @State private var enabled: Bool
  @State private var name: String
  @State private var busy = false
  @State private var error: String?
  let saved: (AccountDashboard) -> Void
  init(snapshot: AccountDashboard, saved: @escaping (AccountDashboard) -> Void) {
    _minutes = State(initialValue: snapshot.preferences.minutesPerCompletedTask)
    _enabled = State(initialValue: snapshot.preferences.leaderboardEnabled)
    _name = State(initialValue: snapshot.preferences.displayName)
    self.saved = saved
  }
  var body: some View {
    Form {
      Section("Your time estimate") {
        Stepper("\(minutes) minutes per completed task", value: $minutes, in: 0...480, step: 5)
        Text(
          "Choose the average hands-on time a completed task saves you. We start at 30 minutes as a placeholder for your estimate, not a measured benchmark. You can set it to zero."
        )
        Text(
          "Estimated hours = completed tasks × your minutes ÷ 60. Changing this setting recalculates both all-time and last-7-days estimates. Failed, queued and draft work adds no estimated hours."
        )
        Text(
          "Telegate does not monitor your screen, location or computer activity to measure time away. Agent runtime is not treated as time saved."
        )
      }
      Section("Community leaderboard") {
        Toggle("Show me on the leaderboard", isOn: $enabled)
        if enabled {
          TextField("Public display name", text: $name).textInputAutocapitalization(.words)
            .autocorrectionDisabled()
        }
        Text(
          "Joining shares your chosen display name and last-7-days shipped/completed counts with other signed-in Telegate users. Your account name, prompts, projects, computers and estimated hours stay private. Turn this off to leave."
        )
      }
      if let error { Text(error).foregroundStyle(.red) }
      Button("Save preferences") { Task { await save() } }.disabled(
        busy || (enabled && name.trimmingCharacters(in: .whitespaces).count < 2))
    }.paperBackground().navigationTitle("Your dashboard settings").navigationBarTitleDisplayMode(
      .inline)
  }
  private func save() async {
    busy = true
    defer { busy = false }
    do {
      let value: AccountDashboard = try await model.api.request(
        "/v1/dashboard/preferences",
        body: [
          "minutesPerCompletedTask": minutes, "leaderboardEnabled": enabled, "displayName": name,
        ])
      saved(value)
      dismiss()
    } catch { self.error = error.localizedDescription }
  }
}

struct LeaderboardView: View {
  @EnvironmentObject var model: AppModel
  @State private var board: CommunityLeaderboard?
  @State private var dashboard: AccountDashboard?
  @State private var error: String?
  var body: some View {
    List {
      Section {
        Text("Good work.\nRoom for everything else.").font(
          .system(.largeTitle, design: .rounded).bold())
        Text(
          "Last 7 days · ranked by prompts shipped. This counts delegation, not measured time away from a screen. Tied counts share a rank."
        ).font(.callout).foregroundStyle(.secondary)
        if let dashboard {
          NavigationLink(
            dashboard.preferences.leaderboardEnabled
              ? "Manage my public profile" : "Join with a display name"
          ) {
            DashboardPreferencesView(snapshot: dashboard) { value in
              self.dashboard = value
              Task { await refresh() }
            }
          }
        }
      }
      if let board {
        if board.entries.isEmpty {
          Section {
            Text(
              "No entries yet. The board shows real opted-in accounts after their first prompt ships. Your personal dashboard works without joining."
            ).foregroundStyle(.secondary)
          }
        } else {
          Section("\(board.participantCount) participants · top 20") {
            ForEach(board.entries) { entry in row(entry) }
          }
          if let yours = board.yourEntry, !board.entries.contains(where: { $0.id == yours.id }) {
            Section("Your place") { row(yours) }
          }
        }
      } else if error == nil {
        ProgressView("Loading leaderboard…")
      }
      if let error {
        Section {
          Text(error).foregroundStyle(.red)
          Button("Try again") { Task { await refresh() } }
        }
      }
    }.paperBackground().navigationTitle("Away from the desk").navigationBarTitleDisplayMode(.inline)
      .task { await refresh() }.refreshable { await refresh() }
  }
  private func row(_ entry: LeaderboardEntry) -> some View {
    HStack(alignment: .top, spacing: 16) {
      Text("#\(entry.rank)").font(.title3.bold()).monospacedDigit().frame(minWidth: 35)
      VStack(alignment: .leading, spacing: 5) {
        Text(entry.displayName + (entry.isYou ? " · You" : "")).font(.headline)
        Text("\(entry.promptsShipped) shipped · \(entry.tasksCompleted) completed").font(.callout)
          .foregroundStyle(.secondary)
      }
    }.padding(.vertical, 8)
  }
  private func refresh() async {
    do {
      async let latest: CommunityLeaderboard = model.api.request("/v1/leaderboard")
      async let prefs: AccountDashboard = model.api.request("/v1/dashboard")
      let values = try await (latest, prefs)
      board = values.0
      dashboard = values.1
      error = nil
    } catch { self.error = error.localizedDescription }
  }
}

#if DEBUG
  // Read-only design fixture. Never available in Release and never writes account metrics.
  struct DashboardDesignPreview: View {
    private let sample = AccountDashboard(
      allTime: DashboardTotals(promptsShipped: 24, tasksCompleted: 12, estimatedMinutesSaved: 360),
      last7Days: DashboardTotals(promptsShipped: 8, tasksCompleted: 2, estimatedMinutesSaved: 60),
      preferences: DashboardPreferences(
        minutesPerCompletedTask: 30, leaderboardEnabled: false, displayName: ""),
      asOf: Date().timeIntervalSince1970 * 1000,
      estimateMethod: "completed_tasks_times_personal_baseline")
    var body: some View {
      NavigationStack {
        ScrollView {
          DashboardContent(snapshot: sample, accountName: "Design preview", startCall: {}) {
            Text("Design preview only. No account data is saved.").padding()
          }
        }.background(Palette.paper)
          .navigationTitle("Design preview · sample data")
          .navigationBarTitleDisplayMode(.inline)
      }.preferredColorScheme(.light)
    }
  }
#endif
