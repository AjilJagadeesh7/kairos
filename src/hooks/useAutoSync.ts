import { useEffect } from 'react'
import { useAppStore } from '../store/useAppStore'

/**
 * Mobile auto-sync. Pushes already fire on every edit, but pulls only ran at
 * cold start — and a mobile app is usually *resumed*, not relaunched, so
 * changes made on other devices never arrived until the next manual sync.
 *
 * This hook triggers a full two-way sync:
 *  - when the app returns to the foreground (Capacitor `appStateChange`)
 *  - every RESYNC_INTERVAL_MS while the app stays foregrounded
 *
 * Desktop is untouched: it re-runs startup sync on every launch and has the
 * vault watcher for local changes.
 */

const RESYNC_INTERVAL_MS = 5 * 60_000
/** Ignore triggers this close to the previous run (startup sync counts). */
const MIN_GAP_MS = 30_000

export function useAutoSync(): void {
  useEffect(() => {
    let disposed = false
    let running = false
    let lastRun = Date.now() // useAppStartup already syncs at launch
    let timer: ReturnType<typeof setInterval> | null = null
    let listener: { remove: () => Promise<void> } | null = null

    async function runSync(): Promise<void> {
      if (running || Date.now() - lastRun < MIN_GAP_MS) return
      const { isPlainFolderConnected } = await import('../sync/plainFolder')
      const { syncAllProviders, anySyncProviderConnected } = await import('../sync/syncOrchestrator')
      if (!isPlainFolderConnected() || !anySyncProviderConnected()) return

      running = true
      lastRun = Date.now()
      try {
        const store = useAppStore.getState()
        await syncAllProviders(store.setSyncStatus)
        // Content categories reload their stores inside the orchestrator;
        // pulled notes need an explicit reload (mirrors useAppStartup).
        await store.loadNotes()
      } catch (err) {
        console.warn('[sync] auto-sync failed:', err)
      } finally {
        running = false
      }
    }

    void (async () => {
      const { isMobile } = await import('../utils/platform')
      if (!isMobile()) return

      const { App } = await import('@capacitor/app')
      const handle = await App.addListener('appStateChange', ({ isActive }) => {
        if (isActive) void runSync()
      })
      if (disposed) { void handle.remove(); return }
      listener = handle

      timer = setInterval(() => {
        if (document.visibilityState === 'visible') void runSync()
      }, RESYNC_INTERVAL_MS)
    })()

    return () => {
      disposed = true
      if (listener) void listener.remove()
      if (timer) clearInterval(timer)
    }
  }, [])
}
