import SwiftUI

/// One derived state drives the status pill, the computer block, the menu bar and the commands.
enum ConnectorState: Equatable {
  case needsService, notPaired, pairing, credentialProblem, noAgents, paused, restarting, running

  var title: String {
    switch self {
    case .needsService: "Needs setup"
    case .notPaired: "Not paired"
    case .pairing: "Pairing"
    case .credentialProblem: "Needs re-pair"
    case .noAgents: "No agents on"
    case .paused: "Paused"
    case .restarting: "Restarting"
    case .running: "Running"
    }
  }
  var canToggle: Bool { self == .paused || self == .running }

  enum IconVariant { case running, paused, alert }
  var iconVariant: IconVariant {
    switch self {
    case .pairing, .restarting, .running: .running
    case .paused, .noAgents: .paused
    case .needsService, .notPaired, .credentialProblem: .alert
    }
  }
}

extension ConnectModel {
  var connectorState: ConnectorState {
    if pair != nil { return .pairing }
    if AppConfiguration.validService(service) == nil { return .needsService }
    if deviceId == nil { return .notPaired }
    if restarting { return .restarting }
    if connected { return .running }
    if credentialProblem != nil { return .credentialProblem }
    if !harnesses.contains(where: \.enabled) { return .noAgents }
    return .paused
  }
  var enabledAgentCount: Int { harnesses.filter(\.enabled).count }
  var validServiceURL: URL? { AppConfiguration.validService(service) }
  var isTunnelAddress: Bool { service.contains("trycloudflare.com") }

  /// Second line of the computer block.
  var statusSentence: String {
    switch connectorState {
    case .needsService: "Add your relay address to begin."
    case .notPaired: "Not paired with a phone."
    case .pairing: "Waiting for your phone."
    case .credentialProblem: "Paired, but no usable token is stored: \(credentialProblem ?? "unknown reason"). Re-pair once to continue."
    case .noAgents: "Paused. Turn on at least one agent before resuming."
    case .paused: "Paused. Your phone can’t send work to this Mac."
    case .restarting: "Restarting the connector…"
    case .running:
      enabledAgentCount > 0
        ? "Running. Waiting for work from your phone."
        : "Running, but no agent is turned on. Work will fail until you turn one on."
    }
  }
  /// First line of the menu bar menu.
  var menuTitle: String {
    switch connectorState {
    case .needsService: "Set relay address in Settings"
    case .notPaired: "Not paired"
    case .pairing: "Pairing · waiting for your phone"
    case .credentialProblem: "Needs re-pair"
    case .noAgents: "Paused · no agents on"
    case .paused: "Paused"
    case .restarting: "Restarting…"
    case .running: "Running · \(enabledAgentCount) agent\(enabledAgentCount == 1 ? "" : "s") on"
    }
  }
  /// Colour of the status dot.
  var statusColor: Color {
    if error != nil && connectorState != .running { return .red }
    switch connectorState {
    case .running: return ConnectStyle.mint
    case .pairing: return .accentColor
    case .credentialProblem, .noAgents: return .orange
    case .needsService, .notPaired, .paused, .restarting: return Color(nsColor: .tertiaryLabelColor)
    }
  }

  /// Save a change to the agents list; restart the connector if it is running; revert on failure.
  /// Returns the error message, if any.
  @discardableResult
  /// Agent changes are saved only: the connector re-reads the config file on every poll,
  /// so nothing needs a restart (and a running task is never interrupted).
  func applyAgents(restartConnector: Bool = false, _ change: (inout [LocalHarness]) -> Void) -> String? {
    let previous = harnesses
    change(&harnesses)
    do {
      try save(requireService: false)
      error = nil
      if restartConnector { restart() }
      return nil
    } catch {
      harnesses = previous
      self.error = error.localizedDescription
      return error.localizedDescription
    }
  }
}
