import AppKit
import Foundation

// Renders the app icons from brand/telegate-mark.svg (mint mark, ink tick).
// iOS: full-bleed ink square, no alpha channel (App Store rejects transparency).
// macOS: rounded square with transparent margins, per the Big Sur icon grid.
let root=URL(fileURLWithPath:CommandLine.arguments[1])
let ink=NSColor(calibratedRed:0.08,green:0.13,blue:0.16,alpha:1)
guard let mark=NSImage(contentsOf:root.appendingPathComponent("brand/telegate-mark.svg")) else {fatalError("brand/telegate-mark.svg not found or not readable")}
func render(_ size:Int,mac:Bool)->Data {
    let rep=NSBitmapImageRep(bitmapDataPlanes:nil,pixelsWide:size,pixelsHigh:size,bitsPerSample:8,samplesPerPixel:4,hasAlpha:true,isPlanar:false,colorSpaceName:.deviceRGB,bytesPerRow:0,bitsPerPixel:0)!
    NSGraphicsContext.saveGraphicsState();NSGraphicsContext.current=NSGraphicsContext(bitmapImageRep:rep)
    let context=NSGraphicsContext.current!.cgContext;context.scaleBy(x:CGFloat(size)/1024,y:CGFloat(size)/1024)
    NSGraphicsContext.current!.imageInterpolation = .high
    if mac {
        let body=NSRect(x:100,y:100,width:824,height:824)
        ink.setFill();NSBezierPath(roundedRect:body,xRadius:185,yRadius:185).fill()
        mark.draw(in:body,from:.zero,operation:.sourceOver,fraction:1)
    } else {
        ink.setFill();NSBezierPath(rect:NSRect(x:0,y:0,width:1024,height:1024)).fill()
        mark.draw(in:NSRect(x:0,y:0,width:1024,height:1024),from:.zero,operation:.sourceOver,fraction:1)
    }
    NSGraphicsContext.restoreGraphicsState()
    if mac {return rep.representation(using:.png,properties:[:])!}
    // iOS: re-encode without an alpha channel (App Store rejects transparent marketing icons).
    let opaque=CGContext(data:nil,width:size,height:size,bitsPerComponent:8,bytesPerRow:0,space:CGColorSpaceCreateDeviceRGB(),bitmapInfo:CGImageAlphaInfo.noneSkipLast.rawValue)!
    opaque.draw(rep.cgImage!,in:CGRect(x:0,y:0,width:size,height:size))
    return NSBitmapImageRep(cgImage:opaque.makeImage()!).representation(using:.png,properties:[:])!
}
for platform in ["ios/Telegate","mac/TelegateConnect"] {
    let directory=root.appendingPathComponent(platform+"/Assets.xcassets/AppIcon.appiconset")
    try FileManager.default.createDirectory(at:directory,withIntermediateDirectories:true)
    var images:[[String:Any]]=[]
    if platform.hasPrefix("ios") {try render(1024,mac:false).write(to:directory.appendingPathComponent("AppIcon.png"));images=[["filename":"AppIcon.png","idiom":"universal","platform":"ios","size":"1024x1024"]]}
    else {for size in [16,32,128,256,512] {for scale in [1,2]{let name="icon-\(size)-\(scale).png";try render(size*scale,mac:true).write(to:directory.appendingPathComponent(name));images.append(["filename":name,"idiom":"mac","size":"\(size)x\(size)","scale":"\(scale)x"])}}}
    let content:[String:Any]=["images":images,"info":["author":"xcode","version":1]]
    try JSONSerialization.data(withJSONObject:content,options:.prettyPrinted).write(to:directory.appendingPathComponent("Contents.json"))
}
print("icons rendered")
