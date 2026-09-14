import SwiftUI

struct ActivityView: View {
  @EnvironmentObject var model: ConnectModel
  @AppStorage("activityAutoScroll") private var autoScroll = true

  var body: some View {
    Group {
      if model.log.isEmpty {
        ContentUnavailableView(
          "No Activity Yet", systemImage: "list.bullet.rectangle",
          description: Text(model.deviceId == nil ? "Pair with your phone to start the connector." : "Resume the connector to see what it does."))
      } else {
        ScrollViewReader { proxy in
          ScrollView {
            VStack(alignment: .leading, spacing: 0) {
              Text(model.log)
                .font(.system(.caption, design: .monospaced))
                .foregroundStyle(.primary)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(12)
                .textSelection(.enabled)
              Color.clear.frame(height: 1).id("end")
            }
            .frame(maxWidth: .infinity, alignment: .topLeading)
          }
          .background(ConnectStyle.text)
          .onChange(of: model.log) { _, _ in if autoScroll { proxy.scrollTo("end", anchor: .bottom) } }
        }
      }
    }
    .navigationTitle("Activity")
    .toolbar {
      ToolbarItemGroup(placement: .primaryAction) {
        Toggle(isOn: $autoScroll) { Label("Auto-scroll", systemImage: "arrow.down.to.line") }
          .toggleStyle(.button).help("Follow new lines").accessibilityLabel("Auto-scroll")
        CopyButton(value: model.log, label: "Copy Log", bordered: true)
        Button { model.log = "" } label: { Label("Clear", systemImage: "trash") }
          .help("Clear the log").accessibilityLabel("Clear log")
      }
    }
    .safeAreaInset(edge: .bottom) {
      HStack {
        Text("Connector: \(model.connectorState.title)")
        Spacer()
        Text("Node: \(model.node)").lineLimit(1).truncationMode(.middle)
      }
      .font(.caption).foregroundStyle(.secondary)
      .padding(.horizontal, 12).padding(.vertical, 6)
      .background(.bar)
    }
  }
}
