import type { HandwritingRecognizer, RecognizeOptions } from './HandwritingRecognizer'
import type { Stroke } from '../../types'

/** Serialized stroke for the Rust `recognize_ink` command. */
interface IpcStroke { x: number[]; y: number[] }

function toIpc(strokes: Stroke[]): IpcStroke[] {
  return strokes.map(s => ({
    x: s.points.map(p => Math.round(p.x)),
    y: s.points.map(p => Math.round(p.y)),
  }))
}

/** True only on Windows desktop — the only desktop OS with a native ink engine. */
function isWindows(): boolean {
  return /windows/i.test(navigator.userAgent)
}

/**
 * Desktop recognizer backed by the Tauri `recognize_ink` command, which bridges
 * to Windows.UI.Input.Inking.InkRecognizer (see src-tauri — feature-gated to
 * Windows). On Linux/macOS desktop there is no native engine, so this reports
 * unavailable and to-text mode is hidden.
 */
export function createTauriRecognizer(): HandwritingRecognizer {
  return {
    id: 'windows-ink',
    async isAvailable(): Promise<boolean> {
      if (!isWindows()) return false
      try {
        const { invoke } = await import('@tauri-apps/api/core')
        const ok = await invoke<boolean>('recognize_ink_available')
        return !!ok
      } catch {
        return false
      }
    },
    async recognize(strokes: Stroke[], opts: RecognizeOptions): Promise<string> {
      const { invoke } = await import('@tauri-apps/api/core')
      return invoke<string>('recognize_ink', {
        strokes: toIpc(strokes),
        width: Math.round(opts.width),
        height: Math.round(opts.height),
        language: opts.language ?? 'en-US',
      })
    },
  }
}
