import type { Stroke } from '../../types'

export interface RecognizeOptions {
  /** Overlay canvas size — lets native engines normalize stroke coordinates. */
  width: number
  height: number
  /** BCP-47 language tag, e.g. 'en-US'. Native engines use it to pick a model. */
  language?: string
}

/**
 * A platform-native handwriting → text engine. Implementations bridge to:
 *   - Android: ML Kit Digital Ink Recognition (on-device, offline, free)
 *   - iOS:     Apple Vision / PencilKit recognition (on-device)
 *   - Windows: Windows.UI.Input.Inking InkRecognizer (on-device, via Tauri)
 *
 * There is no browser/web engine, so on unsupported platforms `isAvailable`
 * resolves false and the UI hides to-text mode.
 */
export interface HandwritingRecognizer {
  readonly id: string
  /** Whether this engine can run on the current device right now. */
  isAvailable(): Promise<boolean>
  /** Convert captured ink to text. Throws if unavailable. */
  recognize(strokes: Stroke[], opts: RecognizeOptions): Promise<string>
}
