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

export type Platform = 'desktop' | 'mobile'
export const getPlatform = (): Platform => {
  if (isMobile()) return 'mobile'
  return 'desktop'
}
