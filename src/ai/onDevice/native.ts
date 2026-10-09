/**
 * Bridges to the native on-device pieces (Full build only):
 *  - desktop: Tauri commands from `src-tauri/src/local_model.rs` (downloads,
 *    device check) and the llama.cpp runtime, behind the `local-llm` feature;
 *  - Android: the `LocalModel` / `LocalLlm` Capacitor plugins in the `full`
 *    flavor.
 * In a build without them every call fails, which reads as "not available".
 */
import { isDesktop, isMobile } from '../../utils/platform'
import type { DeviceInfo, LocalGenerateRequest, LocalRuntime, LocalTokenEvent, ModelDownloadEvent, ModelStatus } from '../../types'

export interface ModelFiles {
  deviceInfo(): Promise<DeviceInfo>
  status(id: string): Promise<ModelStatus>
  /** Downloads (or resumes) a model from the pinned list, verifying its SHA-256. */
  download(id: string, onEvent: (e: ModelDownloadEvent) => void): Promise<void>
  pause(id: string): Promise<void>
  remove(id: string): Promise<void>
}

interface LocalModelPlugin {
  deviceInfo(): Promise<DeviceInfo>
  status(o: { id: string }): Promise<ModelStatus>
  download(o: { id: string }): Promise<void>
  pause(o: { id: string }): Promise<void>
  remove(o: { id: string }): Promise<void>
  addListener(name: 'download', fn: (e: ModelDownloadEvent & { id: string }) => void): Promise<{ remove: () => Promise<void> }>
}

interface LocalLlmPlugin {
  available(): Promise<{ value: boolean }>
  load(o: { path: string; contextTokens: number }): Promise<void>
  unload(): Promise<void>
  generate(o: { request: LocalGenerateRequest }): Promise<void>
  abort(): Promise<void>
  addListener(name: 'token', fn: (e: LocalTokenEvent) => void): Promise<{ remove: () => Promise<void> }>
}

async function capacitorPlugin<T>(name: string): Promise<T> {
  const { registerPlugin } = await import('@capacitor/core')
  return registerPlugin<T>(name) as T
}

/** Resolves on `done`, rejects on `error`, from a stream of events. */
function untilDone<E extends { type: string }>(start: (onEvent: (e: E) => void) => Promise<unknown>, onEvent: (e: E) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    start((e) => {
      onEvent(e)
      if (e.type === 'done' || e.type === 'paused') resolve()
      if (e.type === 'error') reject(new Error((e as unknown as { message: string }).message))
    }).catch(reject)
  })
}

export async function modelFiles(): Promise<ModelFiles | null> {
  if (isDesktop()) {
    const { invoke, Channel } = await import('@tauri-apps/api/core')
    return {
      deviceInfo: () => invoke('model_device_info'),
      status: (id) => invoke('model_status', { id }),
      download: (id, onEvent) => untilDone<ModelDownloadEvent>(async (emit) => {
        const channel = new Channel<ModelDownloadEvent>()
        channel.onmessage = emit
        await invoke('model_download', { id, onEvent: channel })
      }, onEvent),
      pause: (id) => invoke('model_pause', { id }),
      remove: (id) => invoke('model_delete', { id }),
    }
  }
  if (isMobile()) {
    const p = await capacitorPlugin<LocalModelPlugin>('LocalModel')
    return {
      deviceInfo: () => p.deviceInfo(),
      status: (id) => p.status({ id }),
      download: (id, onEvent) => untilDone<ModelDownloadEvent>(async (emit) => {
        const handle = await p.addListener('download', (e) => { if (e.id === id) emit(e) })
        try { await p.download({ id }) } finally { void handle.remove() }
      }, onEvent),
      pause: (id) => p.pause({ id }),
      remove: (id) => p.remove({ id }),
    }
  }
  return null
}

export async function localRuntime(): Promise<LocalRuntime | null> {
  if (isDesktop()) {
    const { invoke, Channel } = await import('@tauri-apps/api/core')
    return {
      available: async () => { try { return await invoke<boolean>('llm_available') } catch { return false } },
      load: (path, contextTokens) => invoke('llm_load', { path, contextTokens }),
      unload: () => invoke('llm_unload'),
      generate: (request, onEvent) => untilDone<LocalTokenEvent>(async (emit) => {
        const channel = new Channel<LocalTokenEvent>()
        channel.onmessage = emit
        await invoke('llm_generate', { request, onEvent: channel })
      }, onEvent),
      abort: () => invoke('llm_abort'),
    }
  }
  if (isMobile()) {
    const p = await capacitorPlugin<LocalLlmPlugin>('LocalLlm')
    return {
      available: async () => { try { return (await p.available()).value } catch { return false } },
      load: (path, contextTokens) => p.load({ path, contextTokens }),
      unload: () => p.unload(),
      generate: (request, onEvent) => untilDone<LocalTokenEvent>(async (emit) => {
        const handle = await p.addListener('token', emit)
        try { await p.generate({ request }) } finally { void handle.remove() }
      }, onEvent),
      abort: () => p.abort(),
    }
  }
  return null
}
