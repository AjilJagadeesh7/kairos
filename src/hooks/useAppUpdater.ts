import { useState, useCallback } from 'react'
import { isDesktop } from '../utils/platform'

export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'up-to-date'
  | 'available'
  | 'downloading'
  | 'ready'
  | 'error'

export interface UpdateInfo {
  version: string
  body: string | null
}

export function useAppUpdater() {
  const [status, setStatus]       = useState<UpdateStatus>('idle')
  const [info, setInfo]           = useState<UpdateInfo | null>(null)
  const [downloaded, setDownloaded] = useState(0)
  const [total, setTotal]         = useState(0)
  const [error, setError]         = useState<string | null>(null)

  const checkForUpdate = useCallback(async () => {
    if (!isDesktop()) return
    setStatus('checking')
    setError(null)
    try {
      const { check } = await import('@tauri-apps/plugin-updater')
      const update = await check()
      if (update?.available) {
        setInfo({ version: update.version, body: update.body ?? null })
        setStatus('available')
      } else {
        setStatus('up-to-date')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
      setStatus('error')
    }
  }, [])

  const downloadAndInstall = useCallback(async () => {
    if (!isDesktop() || status !== 'available') return
    setStatus('downloading')
    setDownloaded(0)
    setTotal(0)
    try {
      const { check } = await import('@tauri-apps/plugin-updater')
      const update = await check()
      if (!update?.available) { setStatus('up-to-date'); return }

      await update.downloadAndInstall(event => {
        switch (event.event) {
          case 'Started':
            setTotal(event.data.contentLength ?? 0)
            break
          case 'Progress':
            setDownloaded(d => d + event.data.chunkLength)
            break
          case 'Finished':
            break
        }
      })
      setStatus('ready')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Download failed')
      setStatus('error')
    }
  }, [status])

  const restart = useCallback(async () => {
    if (!isDesktop()) return
    try {
      const { relaunch } = await import('@tauri-apps/plugin-process')
      await relaunch()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Relaunch failed')
      setStatus('error')
    }
  }, [])

  const progressPct = total > 0 ? Math.min(Math.round((downloaded / total) * 100), 99) : 0

  return { status, info, progressPct, error, checkForUpdate, downloadAndInstall, restart }
}
