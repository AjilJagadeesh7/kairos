package com.kairos.app.handwriting

import com.getcapacitor.JSObject
import com.getcapacitor.Plugin
import com.getcapacitor.PluginCall
import com.getcapacitor.PluginMethod
import com.getcapacitor.annotation.CapacitorPlugin
import com.google.mlkit.common.model.DownloadConditions
import com.google.mlkit.common.model.RemoteModelManager
import com.google.mlkit.vision.digitalink.DigitalInkRecognition
import com.google.mlkit.vision.digitalink.DigitalInkRecognitionModel
import com.google.mlkit.vision.digitalink.DigitalInkRecognitionModelIdentifier
import com.google.mlkit.vision.digitalink.DigitalInkRecognizerOptions
import com.google.mlkit.vision.digitalink.Ink

/**
 * ML Kit Digital Ink Recognition bridge. On-device, offline, free.
 * Matches the TS HandwritingPlugin interface in capacitorPlugin.ts.
 */
@CapacitorPlugin(name = "Handwriting")
class HandwritingPlugin : Plugin() {

    private val remoteModelManager = RemoteModelManager.getInstance()

    private fun modelFor(language: String): DigitalInkRecognitionModel {
        val tag = language.ifBlank { "en-US" }
        val id = DigitalInkRecognitionModelIdentifier.fromLanguageTag(tag)
            ?: DigitalInkRecognitionModelIdentifier.fromLanguageTag("en-US")!!
        return DigitalInkRecognitionModel.builder(id).build()
    }

    @PluginMethod
    fun isAvailable(call: PluginCall) {
        val model = modelFor(call.getString("language") ?: "en-US")
        remoteModelManager.isModelDownloaded(model)
            .addOnSuccessListener { downloaded ->
                if (downloaded) {
                    call.resolve(JSObject().put("available", true))
                } else {
                    // Kick off a download for next time; report not-yet-available now.
                    remoteModelManager.download(model, DownloadConditions.Builder().build())
                    call.resolve(JSObject().put("available", false))
                }
            }
            .addOnFailureListener { call.resolve(JSObject().put("available", false)) }
    }

    @PluginMethod
    fun recognize(call: PluginCall) {
        val language = call.getString("language") ?: "en-US"
        val strokesArr = call.getArray("strokes")
            ?: return call.reject("missing strokes")

        val inkBuilder = Ink.builder()
        for (i in 0 until strokesArr.length()) {
            val stroke = strokesArr.getJSONObject(i)
            val xs = stroke.getJSONArray("x")
            val ys = stroke.getJSONArray("y")
            val ts = if (stroke.has("t")) stroke.getJSONArray("t") else null
            val sb = Ink.Stroke.builder()
            for (p in 0 until xs.length()) {
                val x = xs.getDouble(p).toFloat()
                val y = ys.getDouble(p).toFloat()
                if (ts != null) sb.addPoint(Ink.Point.create(x, y, ts.getLong(p)))
                else sb.addPoint(Ink.Point.create(x, y))
            }
            inkBuilder.addStroke(sb.build())
        }
        val ink = inkBuilder.build()

        val model = modelFor(language)
        remoteModelManager.download(model, DownloadConditions.Builder().build())
            .addOnSuccessListener {
                val recognizer = DigitalInkRecognition.getClient(
                    DigitalInkRecognizerOptions.builder(model).build()
                )
                recognizer.recognize(ink)
                    .addOnSuccessListener { result ->
                        val text = result.candidates.firstOrNull()?.text ?: ""
                        call.resolve(JSObject().put("text", text))
                    }
                    .addOnFailureListener { e -> call.reject("recognition failed", e) }
            }
            .addOnFailureListener { e -> call.reject("model download failed", e) }
    }
}
