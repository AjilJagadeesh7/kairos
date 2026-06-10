# Native handwriting recognition (to-text pen mode)

The to-text pen mode converts captured ink to text using a **platform-native,
on-device** engine. There is no web/browser engine, so to-text mode is hidden
on any platform without a working native bridge (Linux/macOS desktop, web).

The TypeScript side is already complete:

| Platform | Engine | Bridge | JS adapter |
|---|---|---|---|
| Android | ML Kit Digital Ink Recognition (free, offline) | Capacitor plugin `Handwriting` | `capacitorRecognizer.ts` |
| iOS / iPadOS | Vision text recognition over rendered ink | Capacitor plugin `Handwriting` | `capacitorRecognizer.ts` |
| Windows | `Windows.UI.Input.Inking.InkRecognizer` | Tauri command `recognize_ink` | `tauriRecognizer.ts` |

The JS factory (`../index.ts`) picks the engine and gracefully reports
`unavailable` if the native side isn't installed. The files in this folder are
the native implementations to drop into each platform project — they are **not**
compiled by the web build.

---

## Android (ML Kit)

> Requires the Capacitor Android project: `npx cap add android`.

1. Copy `android/HandwritingPlugin.kt` into
   `android/app/src/main/java/com/kairos/app/handwriting/`.
2. Register it in `MainActivity`:
   ```kotlin
   registerPlugin(HandwritingPlugin::class.java)
   ```
3. Add the dependency to `android/app/build.gradle`:
   ```gradle
   implementation 'com.google.mlkit:digital-ink-recognition:18.1.0'
   ```
The plugin downloads the language model on first use (`isAvailable`).

## iOS / iPadOS (Vision)

> Requires the Capacitor iOS project: `npx cap add ios`.

1. Copy `ios/HandwritingPlugin.swift` into the iOS app target (e.g.
   `ios/App/App/handwriting/`).
2. Capacitor auto-discovers the `CAPPlugin` subclass — no manual registration.
3. Vision ships with iOS; no extra pods. We render strokes to an image and run
   `VNRecognizeTextRequest`. (For best Apple Pencil quality you can later swap in
   PencilKit stroke capture, but the JS bridge already sends the raw strokes.)

## Windows (Tauri)

1. Copy `tauri/recognize_ink_windows.rs` into `src-tauri/src/`.
2. Add to `src-tauri/Cargo.toml`:
   ```toml
   [target.'cfg(windows)'.dependencies]
   windows = { version = "0.58", features = [
     "UI_Input_Inking", "UI_Input_Inking_Analysis", "Foundation_Collections",
   ] }
   ```
3. Replace the placeholder `recognize_ink` / `recognize_ink_available` bodies in
   `src-tauri/src/lib.rs` with calls into the new module (guarded by
   `#[cfg(windows)]`; keep the stub for other targets).

No Tauri capability/permission entry is needed — `invoke` of app-defined
commands is always allowed.
