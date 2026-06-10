import { Capacitor } from '@capacitor/core'
import { isDesktop } from '../../utils/platform'
import type { HandwritingRecognizer } from './HandwritingRecognizer'

export type { HandwritingRecognizer, RecognizeOptions } from './HandwritingRecognizer'

let _recognizer: HandwritingRecognizer | null = null
let _availability: Promise<boolean> | null = null

/** The recognizer for the current platform (or null on platforms with none). */
async function resolveRecognizer(): Promise<HandwritingRecognizer | null> {
  if (_recognizer) return _recognizer

  if (isDesktop()) {
    const { createTauriRecognizer } = await import('./tauriRecognizer')
    _recognizer = createTauriRecognizer()
    return _recognizer
  }

  const platform = Capacitor.getPlatform() // 'android' | 'ios' | 'web'
  if (platform === 'android' || platform === 'ios') {
    const { createCapacitorRecognizer } = await import('./capacitorRecognizer')
    _recognizer = createCapacitorRecognizer(platform === 'android' ? 'mlkit' : 'apple')
    return _recognizer
  }

  return null
}

export async function getRecognizer(): Promise<HandwritingRecognizer | null> {
  return resolveRecognizer()
}

/**
 * Whether to-text mode should be offered on this device. Cached after the first
 * check so the toolbar can read it cheaply. Never throws.
 */
export async function isHandwritingToTextAvailable(): Promise<boolean> {
  if (_availability) return _availability
  _availability = (async () => {
    try {
      const rec = await resolveRecognizer()
      return rec ? await rec.isAvailable() : false
    } catch {
      return false
    }
  })()
  return _availability
}
