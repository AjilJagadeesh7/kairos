import Capacitor
import Foundation
import UIKit
import Vision

/// iOS/iPadOS handwriting recognition. Renders the captured ink to an image and
/// runs Vision's text recognizer (on-device). Matches the TS HandwritingPlugin
/// interface in capacitorPlugin.ts.
@objc(HandwritingPlugin)
public class HandwritingPlugin: CAPPlugin {

    @objc func isAvailable(_ call: CAPPluginCall) {
        // Vision text recognition is available on iOS 13+.
        if #available(iOS 13.0, *) {
            call.resolve(["available": true])
        } else {
            call.resolve(["available": false])
        }
    }

    @objc func recognize(_ call: CAPPluginCall) {
        guard #available(iOS 13.0, *) else {
            call.resolve(["text": ""]); return
        }
        let strokes = call.getArray("strokes", JSObject.self) ?? []
        let width = CGFloat(call.getInt("width") ?? 0)
        let height = CGFloat(call.getInt("height") ?? 0)
        guard width > 0, height > 0 else { call.resolve(["text": ""]); return }

        let image = renderInk(strokes: strokes, size: CGSize(width: width, height: height))
        guard let cgImage = image?.cgImage else { call.resolve(["text": ""]); return }

        let request = VNRecognizeTextRequest { request, _ in
            let observations = request.results as? [VNRecognizedTextObservation] ?? []
            let text = observations
                .compactMap { $0.topCandidates(1).first?.string }
                .joined(separator: " ")
            call.resolve(["text": text])
        }
        request.recognitionLevel = .accurate
        request.usesLanguageCorrection = true

        let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
        DispatchQueue.global(qos: .userInitiated).async {
            do { try handler.perform([request]) }
            catch { call.reject("recognition failed: \(error.localizedDescription)") }
        }
    }

    /// Draw strokes onto a white canvas so Vision sees high-contrast ink.
    private func renderInk(strokes: [JSObject], size: CGSize) -> UIImage? {
        let renderer = UIGraphicsImageRenderer(size: size)
        return renderer.image { ctx in
            UIColor.white.setFill()
            ctx.fill(CGRect(origin: .zero, size: size))
            UIColor.black.setStroke()
            let path = UIBezierPath()
            path.lineWidth = 3
            path.lineCapStyle = .round
            path.lineJoinStyle = .round
            for stroke in strokes {
                guard let xs = stroke["x"] as? [Double],
                      let ys = stroke["y"] as? [Double], xs.count == ys.count, xs.count > 0
                else { continue }
                path.move(to: CGPoint(x: xs[0], y: ys[0]))
                for i in 1..<xs.count { path.addLine(to: CGPoint(x: xs[i], y: ys[i])) }
            }
            path.stroke()
        }
    }
}
