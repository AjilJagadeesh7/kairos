import { useState, useCallback, useRef } from 'react'
import { isMobile } from '../utils/platform'
import type { UpdateStatus, UpdateInfo } from './useAppUpdater'

// Self-hosted OTA manifest, published to GitHub Releases by the CI `android`
// job (see scripts/build-mobile-bundle.mjs). The stable "latest release" URL
// mirrors how the desktop Tauri updater points at latest.json.
const MANIFEST_URL =
  'https://github.com/AjilJagadeesh7/kairos/releases/latest/download/mobile-latest.json'

interface Manifest {
  version: string
  url: string
  minNative?: string
  mandatory?: boolean
  sha256?: string
  size?: number
  notes?: string | null
}

export type MobileUpdateCheck =
  | { kind: 'up-to-date' }
  | { kind: 'available'; version: string; notes: string | null }
  | { kind: 'needs-native'; version: string } // OTA needs a newer APK than installed

/** Compare dotted numeric versions. >0 if a>b, <0 if a<b, 0 if equal. */
function cmpVersion(a: string, b: string): number {
  const pa = a.split('.').map(n => parseInt(n, 10) || 0)
  const pb = b.split('.').map(n => parseInt(n, 10) || 0)
  const len = Math.max(pa.length, pb.length)
  for (let i = 0; i < len; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0)
    if (d !== 0) return d
  }
  return 0
}

async function fetchManifest(): Promise<Manifest> {
  const res = await fetch(MANIFEST_URL, { cache: 'no-store' })
  if (!res.ok) throw new Error(`Manifest fetch failed (${res.status})`)
  return (await res.json()) as Manifest
}

/**
 * Stateless OTA check shared by the startup toast (useAppStartup) and the
 * Settings UI (the hook below), so both use one code path. Reads the active
 * Capgo bundle, fetches our GitHub-hosted manifest, and classifies the result.
 */
export async function checkMobileUpdate(): Promise<MobileUpdateCheck> {
  const { CapacitorUpdater } = await import('@capgo/capacitor-updater')
  const cur = await CapacitorUpdater.current()
  // On the APK-baked assets the active bundle id is "builtin"; treat the
  // installed APK's native version as the effective running web version.
  const installed = cur.bundle?.id === 'builtin' ? cur.native : cur.bundle.version

  const m = await fetchManifest()

  // Compat gate: a bundle that needs a newer native shell than the installed
  // APK cannot be applied OTA — the user must update via the store/APK.
  if (m.minNative && cmpVersion(m.minNative, cur.native) > 0) {
    return { kind: 'needs-native', version: m.version }
  }
  if (cmpVersion(m.version, installed) > 0) {
    return { kind: 'available', version: m.version, notes: m.notes ?? null }
  }
  return { kind: 'up-to-date' }
}

/**
 * Mobile OTA updater — the Capacitor twin of {@link useAppUpdater}. Returns the
 * same shape so <UpdatesSection> can drive either one. Uses Capgo's manual mode
 * (download/set), pulling web bundles from our own GitHub Releases. No Capgo
 * Cloud, no server. See CLAUDE.md / capacitor.config.ts.
 */
export function useMobileUpdater() {
  const [status, setStatus]           = useState<UpdateStatus>('idle')
  const [info, setInfo]               = useState<UpdateInfo | null>(null)
  const [progressPct, setProgressPct] = useState(0)
  const [error, setError]             = useState<string | null>(null)
  const pendingRef = useRef<{ id: string; version: string } | null>(null)

  const checkForUpdate = useCallback(async () => {
    if (!isMobile()) return
    setStatus('checking')
    setError(null)
    try {
      const r = await checkMobileUpdate()
      if (r.kind === 'available') {
        setInfo({ version: r.version, body: r.notes })
        pendingRef.current = null
        setStatus('available')
      } else if (r.kind === 'needs-native') {
        setInfo({ version: r.version, body: null })
        setStatus('needs-native')
      } else {
        setStatus('up-to-date')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update check failed')
      setStatus('error')
    }
  }, [])

  const downloadAndInstall = useCallback(async () => {
    if (!isMobile() || status !== 'available') return
    setStatus('downloading')
    setProgressPct(0)
    let removeListener: (() => void) | undefined
    try {
      const { CapacitorUpdater } = await import('@capgo/capacitor-updater')
      const m = await fetchManifest()

      const handle = await CapacitorUpdater.addListener('download', state => {
        setProgressPct(Math.min(Math.round(state.percent), 99))
      })
      removeListener = () => { void handle.remove() }

      const bundle = await CapacitorUpdater.download({ url: m.url, version: m.version })
      pendingRef.current = { id: bundle.id, version: bundle.version }
      setStatus('ready')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Download failed')
      setStatus('error')
    } finally {
      removeListener?.()
    }
  }, [status])

  const restart = useCallback(async () => {
    if (!isMobile() || !pendingRef.current) return
    try {
      const { CapacitorUpdater } = await import('@capgo/capacitor-updater')
      // set() activates the downloaded bundle and reloads the webview into it.
      // notifyAppReady() on next launch (useAppStartup) confirms it booted; if
      // it never does, Capgo auto-rolls back to the last good bundle.
      await CapacitorUpdater.set({ id: pendingRef.current.id })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to apply update')
      setStatus('error')
    }
  }, [])

  return { status, info, progressPct, error, checkForUpdate, downloadAndInstall, restart }
}
