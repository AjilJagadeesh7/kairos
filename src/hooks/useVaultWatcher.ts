/**
 * Watches the vault's notes/ directory for external file changes
 * (e.g. edits in VS Code, git pull, another app writing to the vault).
 * When a .md file is created, modified, or removed the provided callback fires.
 * Desktop-only — no-ops on web/mobile where the FS watcher is not available.
 */
import { useEffect, useRef } from 'react'
import { isDesktop } from '../utils/platform'

type UnwatchFn = () => void | Promise<void>

export function useVaultWatcher(
  vaultPath: string | null,
  onExternalChange: () => void,
) {
  const callbackRef = useRef(onExternalChange)
  callbackRef.current = onExternalChange

  useEffect(() => {
    if (!vaultPath || !isDesktop()) return

    let unwatch: UnwatchFn | null = null
    let cancelled = false

    void (async () => {
      try {
        const { watch } = await import('@tauri-apps/plugin-fs')
        const notesPath = `${vaultPath}/notes`

        unwatch = await watch(
          notesPath,
          (event) => {
            // event.paths is string[] of affected paths
            const paths: string[] = (event as { paths?: string[] }).paths ?? []
            const hasMdChange = paths.length === 0 || paths.some(p => p.endsWith('.md'))
            if (hasMdChange) {
              // Debounce: coalesce rapid bursts (e.g. git checkout touching many files)
              scheduleReload()
            }
          },
          { recursive: false },
        )

        if (cancelled) unwatch?.()
      } catch (err) {
        // Plugin not available or vault path invalid — silently skip
        console.debug('[vault-watcher] not available:', err)
      }
    })()

    let reloadTimer: ReturnType<typeof setTimeout> | null = null
    function scheduleReload() {
      if (reloadTimer) clearTimeout(reloadTimer)
      reloadTimer = setTimeout(() => {
        reloadTimer = null
        callbackRef.current()
      }, 600)
    }

    return () => {
      cancelled = true
      if (reloadTimer) clearTimeout(reloadTimer)
      void unwatch?.()
    }
  }, [vaultPath])
}
