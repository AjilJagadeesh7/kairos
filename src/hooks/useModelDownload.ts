import { useCallback, useEffect, useRef, useState } from 'react'
import { useOnDeviceStore } from '../store/useOnDeviceStore'
import { useAiStore } from '../store/useAiStore'
import { modelFiles, type ModelFiles } from '../ai/onDevice/native'
import type { DeviceInfo, ModelStatus } from '../types'

export type DownloadPhase = 'idle' | 'downloading' | 'verifying' | 'error'

/**
 * Settings → AI → On-device model: the selected model's file status, the
 * device check, and download / pause / resume / delete through the native
 * download manager (Full build only). `files` is null where there is none
 * (browser), and the card says so.
 */
export function useModelDownload() {
  const modelId = useOnDeviceStore((s) => s.modelId)
  const setReadyPath = useOnDeviceStore((s) => s.setReadyPath)
  const [files, setFiles] = useState<ModelFiles | null | undefined>(undefined)
  const [device, setDevice] = useState<DeviceInfo | null>(null)
  const [status, setStatus] = useState<ModelStatus | null>(null)
  const [phase, setPhase] = useState<DownloadPhase>('idle')
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const mounted = useRef(true)
  useEffect(() => () => { mounted.current = false }, [])

  const refresh = useCallback(async (f: ModelFiles) => {
    const s = await f.status(modelId)
    if (!mounted.current) return
    setStatus(s)
    // The file on disk is the truth: a deleted or replaced file un-readies the model.
    setReadyPath(s.state === 'ready' ? s.path : null)
  }, [modelId, setReadyPath])

  useEffect(() => {
    let cancelled = false
    void modelFiles().then(async (f) => {
      if (cancelled) return
      setFiles(f)
      if (!f) return
      try {
        setDevice(await f.deviceInfo())
        await refresh(f)
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err))
      }
    })
    return () => { cancelled = true }
  }, [refresh])

  const download = useCallback(async () => {
    if (!files) return
    setError(null)
    setPhase('downloading')
    try {
      await files.download(modelId, (e) => {
        if (!mounted.current) return
        if (e.type === 'progress') setProgress({ done: e.done, total: e.total })
        else if (e.type === 'verifying') setPhase('verifying')
        else if (e.type === 'paused') setProgress((p) => (p ? { ...p, done: e.done } : p))
      })
      setPhase('idle')
    } catch (err) {
      setPhase('error')
      setError(err instanceof Error ? err.message : String(err))
    }
    await refresh(files).catch(() => {})
  }, [files, modelId, refresh])

  const pause = useCallback(() => { void files?.pause(modelId) }, [files, modelId])

  const remove = useCallback(async () => {
    if (!files) return
    if (__BUILD_FLAVOR__ === 'full') {
      const { releaseOnDevice } = await import('../ai/onDevice/onDeviceSession')
      await releaseOnDevice()
    }
    await files.remove(modelId)
    // Surfaces that used the on-device model have nothing to run on now.
    const { surfaceProvider, setSurfaceProvider } = useAiStore.getState()
    for (const s of ['global', 'bubble'] as const) if (surfaceProvider[s] === 'on-device') setSurfaceProvider(s, null)
    setProgress(null)
    await refresh(files)
  }, [files, modelId, refresh])

  return { files, device, status, phase, progress, error, download, pause, remove }
}
