declare global {
  interface Window {
    __TAURI__?: unknown
    __TAURI_INTERNALS__?: unknown
  }
}

import { Capacitor } from '@capacitor/core'

// __TAURI__ requires withGlobalTauri:true in tauri.conf.json (set).
// __TAURI_INTERNALS__ is always present in any Tauri v2 webview as a fallback.
export const isDesktop = () =>
  window.__TAURI__ !== undefined || window.__TAURI_INTERNALS__ !== undefined
export const isMobile = () => Capacitor.isNativePlatform()

/** True on touch-first devices (mobile WebView, tablets). Based on the pointer
 *  type rather than viewport width, so it reflects the actual input device —
 *  used to defer to native text-selection UI and touch affordances. */
export const isTouch = () =>
  typeof window !== 'undefined' && (window.matchMedia?.('(pointer: coarse)').matches ?? false)

export type Platform = 'desktop' | 'mobile'
export const getPlatform = (): Platform => {
  if (isMobile()) return 'mobile'
  return 'desktop'
}
