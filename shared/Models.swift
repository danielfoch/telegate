import Foundation

struct Harness: Codable, Identifiable, Hashable {
  var id: String
  var name: String
  var kind: String
  var enabled: Bool
  var problem: String? = nil
}
struct Computer: Codable, Identifiable, Hashable {
  var id: String
  var name: String
  var platform: String
  var harnesses: [Harness]
  var online: Bool
  var lastSeen: Double?
  var scanMinutes: Int
  var scanRequested: Bool
  var scannedAt: Double?
  var projects: [ProjectSnapshot]
}
struct ProjectSnapshot: Codable, Identifiable, Hashable {
  var id: String
  var name: String
  var harnessIds: [String]
  var branch: String?
  var changedFiles: Int?
  var latestCommit: String?
  var latestCommitAt: Double?
  var status: String
}
struct DelegatedTask: Codable, Identifiable {
  var id: String
  var deviceId: String
  var harnessId: String
  var title: String
  var prompt: String
  var status: String
  var createdAt: Double
  var updatedAt: Double
  var result: String
  var runId: String?
  var threadURL: String?
  var leaseId: String?
  var parentTaskId: String?
  var resumeRunId: String?
}
struct Workspace: Codable {
  var devices: [Computer]
  var tasks: [DelegatedTask]
}
struct Login: Codable {
  var token: String
  var userId: String
  var username: String
  var recoveryKey: String?
}
struct Pairing: Codable {
  var id: String
  var code: String
  var expiresAt: Double
}
struct PairStatus: Codable {
  var status: String
  var deviceId: String?
  var expiresAt: Double
}
struct PairPreview: Codable {
  var name: String
  var platform: String
  var harnesses: [Harness]
  var expiresAt: Double
}
struct OK: Codable { var ok: Bool }
struct TaskEnvelope: Codable { var task: DelegatedTask }
struct TranscriptLine: Codable, Identifiable {
  var id = UUID()
  var role: String
  var text: String
}
struct Target: Identifiable, Hashable, Codable {
  var deviceId: String
  var harnessId: String
  var label: String
  var id: String { deviceId + ":" + harnessId }
}
struct PendingBrief: Identifiable, Codable {
  var id: String
  var deviceId: String
  var harnessId: String
  var title: String
  var prompt: String
  var send: Bool
  var parentTaskId: String? = nil
  var body: [String: Any] {
    var value: [String: Any] = [
      "requestKey": id, "deviceId": deviceId, "harnessId": harnessId, "title": title,
      "prompt": prompt, "send": send,
    ]
    if let parentTaskId { value["parentTaskId"] = parentTaskId }
    return value
  }
}
struct UserFacingError: LocalizedError {
  var message: String
  var errorDescription: String? { message }
}

// Truncate without splitting a Unicode scalar. Byte bounding also bounds tokenization's worst case.
extension String {
  func utf8Prefix(_ bytes: Int) -> String {
    var result = ""
    var used = 0
    for scalar in unicodeScalars {
      let count = scalar.utf8.count
      guard used + count <= max(0, bytes) else { break }
      result.unicodeScalars.append(scalar)
      used += count
    }
    return result
  }
}

struct DashboardTotals: Codable {
  var promptsShipped: Int
  var tasksCompleted: Int
  var estimatedMinutesSaved: Int
}
struct DashboardPreferences: Codable {
  var minutesPerCompletedTask: Int
  var leaderboardEnabled: Bool
  var displayName: String
}
struct AccountDashboard: Codable {
  var allTime: DashboardTotals
  var last7Days: DashboardTotals
  var preferences: DashboardPreferences
  var asOf: Double
  var estimateMethod: String
}
struct LeaderboardEntry: Codable, Identifiable {
  var id: String
  var displayName: String
  var promptsShipped: Int
  var tasksCompleted: Int
  var rank: Int
  var isYou: Bool
}
struct CommunityLeaderboard: Codable {
  var entries: [LeaderboardEntry]
  var yourEntry: LeaderboardEntry?
  var participantCount: Int
  var windowStartedAt: Double
  var asOf: Double
}
