import { registerPlugin } from '@capacitor/core'

/**
 * Bridge to the native "Handwriting" Capacitor plugin (implemented natively for
 * Android via ML Kit Digital Ink and iOS via Apple's recognizer — see
 * src/adapters/handwriting/native/README.md).
 *
 * If the native plugin is not installed in the platform project, `isAvailable`
 * rejects and callers treat the engine as unavailable.
 */
export interface NativeStroke {
  // Flat arrays keep the JS↔native bridge payload small.
  x: number[]
  y: number[]
  /** Per-point timestamps in ms (ML Kit uses these); optional. */
  t?: number[]
}

export interface HandwritingPlugin {
  /** Resolves { available: true } only when an on-device model is ready. */
  isAvailable(options: { language?: string }): Promise<{ available: boolean }>
  /** Recognize ink. Returns the best transcription (may be empty). */
  recognize(options: {
    strokes: NativeStroke[]
    width: number
    height: number
    language?: string
  }): Promise<{ text: string }>
}

export const HandwritingNative = registerPlugin<HandwritingPlugin>('Handwriting')
