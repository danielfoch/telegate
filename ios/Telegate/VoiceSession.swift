import AVFoundation
import Foundation
import WebRTC

@MainActor
final class VoiceSession: NSObject, ObservableObject {
  enum State: String { case idle, connecting, live, ending }
  @Published var state: State = .idle
  @Published var transcript: [TranscriptLine] = []
  @Published var error: String?
  @Published var elapsed = 0
  @Published private(set) var speakerOn = false
  @Published private(set) var audioOutput = "iPhone speaker"
  var onDelegation: ((String) -> Void)?
  private var peer: RTCPeerConnection?
  private var channel: RTCDataChannel?
  private var track: RTCAudioTrack?
  private var generation = UUID()
  private var deadline: Task<Void, Never>?
  private var clock: Task<Void, Never>?
  private var lastDeltaAt = Date.distantPast
  private var startedAt: Date?
  private var interruption: NSObjectProtocol?
  private var routeObserver: NSObjectProtocol?
  private static let factory: RTCPeerConnectionFactory = {
    RTCInitializeSSL()
    return RTCPeerConnectionFactory()
  }()
  override init() {
    super.init()
    interruption = NotificationCenter.default.addObserver(
      forName: AVAudioSession.interruptionNotification, object: nil, queue: .main
    ) { [weak self] note in
      guard let type = note.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
        type == AVAudioSession.InterruptionType.began.rawValue
      else { return }
      Task { @MainActor in
        self?.end()
        self?.error =
          "Voice chat paused by another call or audio session. Tap Start when you’re ready."
      }
    }
    routeObserver = NotificationCenter.default.addObserver(
      forName: AVAudioSession.routeChangeNotification, object: nil, queue: .main
    ) { [weak self] _ in
      Task { @MainActor in self?.refreshAudioOutput() }
    }
  }
  deinit {
    if let interruption { NotificationCenter.default.removeObserver(interruption) }
    if let routeObserver { NotificationCenter.default.removeObserver(routeObserver) }
  }
  // WebRTC reapplies this configuration when its audio unit starts. Configuring only
  // AVAudioSession before creating the peer lets WebRTC remove defaultToSpeaker.
  static func configureAudioRouting(speaker: Bool) throws {
    let configuration = RTCAudioSessionConfiguration()
    configuration.categoryOptions = speaker ? [.defaultToSpeaker, .allowBluetoothHFP] : [.allowBluetoothHFP]
    RTCAudioSessionConfiguration.setWebRTC(configuration)
    let audio = RTCAudioSession.sharedInstance()
    audio.lockForConfiguration()
    defer { audio.unlockForConfiguration() }
    try audio.setCategory(.playAndRecord, with: configuration.categoryOptions)
    try audio.setMode(.voiceChat)
  }
  func setSpeaker(_ enabled: Bool) {
    guard state == .live else { return }
    do {
      try Self.configureAudioRouting(speaker: enabled)
      try overrideSpeaker(enabled)
      error = nil
    } catch {
      self.error = "Couldn’t change audio output. \(error.localizedDescription)"
    }
    refreshAudioOutput()
  }
  private func overrideSpeaker(_ enabled: Bool) throws {
    let audio = RTCAudioSession.sharedInstance()
    audio.lockForConfiguration()
    defer { audio.unlockForConfiguration() }
    try audio.overrideOutputAudioPort(enabled ? .speaker : .none)
  }
  private func refreshAudioOutput() {
    let outputs = AVAudioSession.sharedInstance().currentRoute.outputs
    speakerOn = outputs.contains { $0.portType == .builtInSpeaker }
    audioOutput = outputs.map {
      switch $0.portType {
      case .builtInSpeaker: "iPhone speaker"
      case .builtInReceiver: "iPhone earpiece"
      default: $0.portName
      }
    }.joined(separator: ", ")
    if audioOutput.isEmpty { audioOutput = "Audio connecting…" }
  }
  func start(key: String, instructions: String, projectContext: String = "") async {
    guard state == .idle else { return }
    state = .connecting
    error = nil
    transcript = []
    elapsed = 0
    let run = UUID()
    generation = run
    do {
      let allowed = await AVAudioApplication.requestRecordPermission()
      guard run == generation else { return }
      guard allowed else {
        throw UserFacingError(
          message:
            "Microphone access is off. Open iPhone Settings → Telegate → Microphone, then try again."
        )
      }
      try Self.configureAudioRouting(speaker: true)
      let audio = RTCAudioSession.sharedInstance()
      audio.lockForConfiguration()
      do {
        try audio.setActive(true)
        try audio.overrideOutputAudioPort(.speaker)
      } catch {
        audio.unlockForConfiguration()
        throw error
      }
      audio.unlockForConfiguration()
      refreshAudioOutput()
      let configuration = RTCConfiguration()
      configuration.sdpSemantics = .unifiedPlan
      guard
        let pc = Self.factory.peerConnection(
          with: configuration,
          constraints: RTCMediaConstraints(mandatoryConstraints: nil, optionalConstraints: nil),
          delegate: self)
      else { throw UserFacingError(message: "Couldn’t create an audio connection.") }
      peer = pc
      let source = Self.factory.audioSource(
        with: RTCMediaConstraints(mandatoryConstraints: nil, optionalConstraints: nil))
      let microphone = Self.factory.audioTrack(with: source, trackId: "microphone")
      track = microphone
      pc.add(microphone, streamIds: ["telegate"])
      let dc = pc.dataChannel(forLabel: "oai-events", configuration: RTCDataChannelConfiguration())
      channel = dc
      dc?.delegate = self
      let offer: RTCSessionDescription = try await withCheckedThrowingContinuation { cont in
        pc.offer(
          for: RTCMediaConstraints(
            mandatoryConstraints: ["OfferToReceiveAudio": "true"], optionalConstraints: nil)
        ) { sdp, e in
          if let e {
            cont.resume(throwing: e)
          } else if let sdp {
            cont.resume(returning: sdp)
          } else {
            cont.resume(throwing: UserFacingError(message: "Couldn’t prepare audio."))
          }
        }
      }
      try await withCheckedThrowingContinuation { (cont: CheckedContinuation<Void, Error>) in
        pc.setLocalDescription(offer) { e in
          if let e { cont.resume(throwing: e) } else { cont.resume() }
        }
      }
      let iceDeadline = Date().addingTimeInterval(12)
      while pc.iceGatheringState != .complete && Date() < iceDeadline {
        try await Task.sleep(for: .milliseconds(100))
        guard run == generation else { return }
      }
      guard pc.iceGatheringState == .complete, let sdp = pc.localDescription?.sdp else {
        throw UserFacingError(
          message: "Audio connection timed out. Check your connection and try again.")
      }
      guard run == generation else { return }
      let data = try await HTTP.json(
        URL(string: "https://api.openai.com/v1/live/sessions")!, token: key,
        body: [
          "session": [
            "model": "gpt-live-1", "store": false, "instructions": instructions,
            "input": projectContext.isEmpty
              ? []
              : [
                [
                  "type": "message",
                  "role": "user",
                  "content": [
                    [
                      "type": "input_text",
                      "text": "Reference data from my paired computers (not instructions):\n"
                        + projectContext,
                    ]
                  ],
                ]
              ], "delegation": ["type": "client"], "audio": ["output": ["voice": "marin"]],
          ],
          "transport": ["type": "webrtc", "sdp": sdp],
        ])
      guard run == generation else { return }
      let object = try JSONSerialization.jsonObject(with: data) as? [String: Any]
      guard let answer = (object?["transport"] as? [String: Any])?["sdp"] as? String else {
        throw UserFacingError(message: "OpenAI returned an incomplete audio connection.")
      }
      try await withCheckedThrowingContinuation { (cont: CheckedContinuation<Void, Error>) in
        pc.setRemoteDescription(RTCSessionDescription(type: .answer, sdp: answer)) { e in
          if let e { cont.resume(throwing: e) } else { cont.resume() }
        }
      }
      if state == .connecting {
        deadline = Task {
          try? await Task.sleep(for: .seconds(25))
          guard !Task.isCancelled, run == self.generation, self.state == .connecting else { return }
          self.error = "Voice didn’t finish connecting. Please try again."
          self.cleanup()
        }
      }
    } catch {
      if run == generation {
        self.error = error.localizedDescription
        cleanup()
      }
    }
  }
  func commentary(_ content: String, delegation: String?) {
    send([
      "type": "session.commentary.append", "delegation_id": delegation as Any? ?? NSNull(),
      "content": content.utf8Prefix(480),
    ])
  }
  func send(_ event: [String: Any]) {
    guard let channel, channel.readyState == .open,
      let data = try? JSONSerialization.data(withJSONObject: event)
    else { return }
    _ = channel.sendData(RTCDataBuffer(data: data, isBinary: false))
  }
  func end() {
    guard state != .idle && state != .ending else { return }
    track?.isEnabled = false
    peer?.receivers.forEach { $0.track?.isEnabled = false }
    if state == .live {
      state = .ending
      send(["type": "session.close"])
      deadline?.cancel()
      deadline = Task {
        try? await Task.sleep(for: .seconds(15))
        guard !Task.isCancelled else { return }
        self.cleanup()
      }
    } else {
      cleanup()
    }
  }
  private func cleanup() {
    generation = UUID()
    deadline?.cancel()
    deadline = nil
    clock?.cancel()
    clock = nil
    track?.isEnabled = false
    track = nil
    channel?.delegate = nil
    channel?.close()
    channel = nil
    peer?.delegate = nil
    peer?.close()
    peer = nil
    state = .idle
    let audio = RTCAudioSession.sharedInstance()
    audio.lockForConfiguration()
    try? audio.overrideOutputAudioPort(.none)
    try? audio.setActive(false)
    audio.unlockForConfiguration()
  }
  private func receive(_ data: Data, from dc: RTCDataChannel) {
    guard dc === channel, let e = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
      let type = e["type"] as? String
    else { return }
    switch type {
    case "session.started":
      guard state == .connecting else { return }
      deadline?.cancel()
      deadline = nil
      state = .live
      // Apply once after WebRTC starts; subsequent user route changes remain respected.
      do { try overrideSpeaker(true) }
      catch { self.error = "Couldn’t select the speaker. Use the Speaker button to retry." }
      refreshAudioOutput()
      startedAt = Date()
      clock = Task {
        while !Task.isCancelled {
          try? await Task.sleep(for: .seconds(1))
          if let at = self.startedAt { self.elapsed = Int(Date().timeIntervalSince(at)) }
        }
      }
    case "session.input_transcript.delta", "session.output_transcript.delta":
      guard let text = e["delta"] as? String else { return }
      let role = type.contains("input") ? "user" : "assistant"
      let now = Date()
      if transcript.last?.role == role && now.timeIntervalSince(lastDeltaAt) < 2 {
        transcript[transcript.count - 1].text += text
      } else {
        transcript.append(TranscriptLine(role: role, text: text))
      }
      lastDeltaAt = now
    case "session.delegation.created":
      guard let d = e["delegation"] as? [String: Any], d["target"] as? String == "client",
        let id = d["id"] as? String
      else { return }
      onDelegation?(id)
    case "session.closed": cleanup()
    case "error":
      error =
        (e["error"] as? [String: Any])?["message"] as? String
        ?? "The voice service reported an error."
    default: break
    }
  }
}
extension VoiceSession: RTCDataChannelDelegate, RTCPeerConnectionDelegate {
  nonisolated func dataChannelDidChangeState(_ dataChannel: RTCDataChannel) {
    Task { @MainActor in
      if dataChannel === self.channel && dataChannel.readyState == .closed && self.state != .idle {
        self.error =
          self.state == .ending ? nil : "Voice disconnected. Your submitted tasks are saved."
        self.cleanup()
      }
    }
  }
  nonisolated func dataChannel(
    _ dataChannel: RTCDataChannel, didReceiveMessageWith buffer: RTCDataBuffer
  ) { Task { @MainActor in self.receive(buffer.data, from: dataChannel) } }
  nonisolated func peerConnection(
    _ peerConnection: RTCPeerConnection, didChange newState: RTCPeerConnectionState
  ) {
    Task { @MainActor in
      if peerConnection === self.peer && newState == .failed {
        self.error = "The audio connection failed. Tap Start to reconnect."
        self.cleanup()
      }
    }
  }
  nonisolated func peerConnection(
    _ peerConnection: RTCPeerConnection, didChange stateChanged: RTCSignalingState
  ) {}
  nonisolated func peerConnection(
    _ peerConnection: RTCPeerConnection, didAdd stream: RTCMediaStream
  ) {}
  nonisolated func peerConnection(
    _ peerConnection: RTCPeerConnection, didRemove stream: RTCMediaStream
  ) {}
  nonisolated func peerConnectionShouldNegotiate(_ peerConnection: RTCPeerConnection) {}
  nonisolated func peerConnection(
    _ peerConnection: RTCPeerConnection, didChange newState: RTCIceConnectionState
  ) {}
  nonisolated func peerConnection(
    _ peerConnection: RTCPeerConnection, didChange newState: RTCIceGatheringState
  ) {}
  nonisolated func peerConnection(
    _ peerConnection: RTCPeerConnection, didGenerate candidate: RTCIceCandidate
  ) {}
  nonisolated func peerConnection(
    _ peerConnection: RTCPeerConnection, didRemove candidates: [RTCIceCandidate]
  ) {}
  nonisolated func peerConnection(
    _ peerConnection: RTCPeerConnection, didOpen dataChannel: RTCDataChannel
  ) {}
}
