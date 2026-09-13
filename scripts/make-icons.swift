import AppKit
import Foundation

// Approved Telegate mark, recoloured to the existing chartreuse and near-black palette.
// Resize the canonical asset rather than redrawing a different symbol at each size.
let root = URL(fileURLWithPath: CommandLine.arguments[1])
let source = NSImage(contentsOf: root.appendingPathComponent("assets/brand/telegate-icon.png"))!
func render(_ size: Int) -> Data {
    let rep = NSBitmapImageRep(bitmapDataPlanes: nil, pixelsWide: size, pixelsHigh: size,
        bitsPerSample: 8, samplesPerPixel: 4, hasAlpha: true, isPlanar: false,
        colorSpaceName: .deviceRGB, bytesPerRow: 0, bitsPerPixel: 0)!
    NSGraphicsContext.saveGraphicsState()
    NSGraphicsContext.current = NSGraphicsContext(bitmapImageRep: rep)
    NSGraphicsContext.current!.imageInterpolation = .high
    source.draw(in: NSRect(x: 0, y: 0, width: size, height: size))
    NSGraphicsContext.restoreGraphicsState()
    return rep.representation(using: .png, properties: [:])!
}
for platform in ["ios/Telegate","mac/TelegateConnect"] {
    let directory=root.appendingPathComponent(platform+"/Assets.xcassets/AppIcon.appiconset")
    try FileManager.default.createDirectory(at:directory,withIntermediateDirectories:true)
    var images:[[String:Any]]=[]
    if platform.hasPrefix("ios") {try render(1024).write(to:directory.appendingPathComponent("AppIcon.png"));images=[["filename":"AppIcon.png","idiom":"universal","platform":"ios","size":"1024x1024"]]}
    else {for size in [16,32,128,256,512] {for scale in [1,2]{let name="icon-\(size)-\(scale).png";try render(size*scale).write(to:directory.appendingPathComponent(name));images.append(["filename":name,"idiom":"mac","size":"\(size)x\(size)","scale":"\(scale)x"])}}}
    let content:[String:Any]=["images":images,"info":["author":"xcode","version":1]]
    try JSONSerialization.data(withJSONObject:content,options:.prettyPrinted).write(to:directory.appendingPathComponent("Contents.json"))
}
