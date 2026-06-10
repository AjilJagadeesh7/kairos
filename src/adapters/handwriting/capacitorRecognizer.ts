import type { HandwritingRecognizer, RecognizeOptions } from './HandwritingRecognizer'
import type { Stroke } from '../../types'
import { HandwritingNative, type NativeStroke } from './capacitorPlugin'

function toNative(strokes: Stroke[]): NativeStroke[] {
  return strokes.map(s => {
    const x: number[] = []
    const y: number[] = []
    const t: number[] = []
    let hasT = false
    for (const p of s.points) {
      x.push(Math.round(p.x))
      y.push(Math.round(p.y))
      if (typeof p.t === 'number') { t.push(Math.round(p.t)); hasT = true }
    }
    return hasT ? { x, y, t } : { x, y }
  })
}

/**
 * Recognizer backed by the native Capacitor "Handwriting" plugin. Used on both
 * Android (ML Kit) and iOS (Apple) — the native side picks the right engine.
 * `id` is parameterized only for clearer diagnostics/telemetry.
 */
export function createCapacitorRecognizer(id: string): HandwritingRecognizer {
  return {
    id,
    async isAvailable(): Promise<boolean> {
      try {
        const { available } = await HandwritingNative.isAvailable({ language: 'en-US' })
        return available
      } catch {
        return false
      }
    },
    async recognize(strokes: Stroke[], opts: RecognizeOptions): Promise<string> {
      const { text } = await HandwritingNative.recognize({
        strokes: toNative(strokes),
        width: Math.round(opts.width),
        height: Math.round(opts.height),
        language: opts.language ?? 'en-US',
      })
      return text
    },
  }
}
