import AppKit
import Foundation

// Original vector mark: a receiver passing work to an outgoing arrow.
let root=URL(fileURLWithPath:CommandLine.arguments[1])
func render(_ size:Int)->Data {
    let rep=NSBitmapImageRep(bitmapDataPlanes:nil,pixelsWide:size,pixelsHigh:size,bitsPerSample:8,samplesPerPixel:4,hasAlpha:true,isPlanar:false,colorSpaceName:.deviceRGB,bytesPerRow:0,bitsPerPixel:0)!
    NSGraphicsContext.saveGraphicsState();NSGraphicsContext.current=NSGraphicsContext(bitmapImageRep:rep)
    let context=NSGraphicsContext.current!.cgContext;context.scaleBy(x:CGFloat(size)/1024,y:CGFloat(size)/1024)
    NSColor(calibratedRed:0.08,green:0.13,blue:0.16,alpha:1).setFill();NSBezierPath(rect:NSRect(x:0,y:0,width:1024,height:1024)).fill()
    NSColor(calibratedRed:0.68,green:0.95,blue:0.56,alpha:1).setStroke()
    let receiver=NSBezierPath();receiver.lineWidth=94;receiver.lineCapStyle = .round;receiver.move(to:NSPoint(x:285,y:690));receiver.curve(to:NSPoint(x:655,y:320),controlPoint1:NSPoint(x:235,y:420),controlPoint2:NSPoint(x:470,y:260));receiver.stroke()
    NSColor(calibratedRed:0.68,green:0.95,blue:0.56,alpha:1).setFill()
    NSBezierPath(roundedRect:NSRect(x:205,y:605,width:200,height:130),xRadius:38,yRadius:38).fill()
    NSBezierPath(roundedRect:NSRect(x:578,y:235,width:150,height:210),xRadius:38,yRadius:38).fill()
    NSColor.white.setStroke();let arrow=NSBezierPath();arrow.lineWidth=48;arrow.lineCapStyle = .round;arrow.lineJoinStyle = .round;arrow.move(to:NSPoint(x:528,y:546));arrow.line(to:NSPoint(x:762,y:780));arrow.move(to:NSPoint(x:600,y:780));arrow.line(to:NSPoint(x:762,y:780));arrow.line(to:NSPoint(x:762,y:618));arrow.stroke()
    NSGraphicsContext.restoreGraphicsState()
    return rep.representation(using:.png,properties:[:])!
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
