/**
 * One on-device provider for the whole app, so the model stays loaded
 * between chats (and unloads after 5 idle minutes). Imported only from Full
 * builds.
 */
import { useOnDeviceStore } from '../../store/useOnDeviceStore'
import { isDesktop, isMobile } from '../../utils/platform'
import { ProviderError } from '../providers/errors'
import { localRuntime } from './native'
import { modelById } from './models'
import { OnDeviceProvider } from './onDeviceProvider'

let current: { key: string; provider: OnDeviceProvider } | null = null

export async function onDeviceProvider(): Promise<OnDeviceProvider> {
  const { modelId, readyPath } = useOnDeviceStore.getState()
  const model = modelById(modelId)
  if (!model || !readyPath) throw new ProviderError('config', 'Download the on-device model in Settings → AI first')
  const key = `${model.id}|${readyPath}`
  if (current?.key === key) return current.provider
  await current?.provider.unload()
  const runtime = await localRuntime()
  if (!runtime || !(await runtime.available())) {
    throw new ProviderError('config', 'The on-device runtime isn\'t part of this build or platform')
  }
  const provider = new OnDeviceProvider(runtime, {
    modelPath: readyPath,
    contextTokens: model.contextTokens,
    id: isDesktop() ? 'tauri-llama' : 'capacitor-llama',
    isBackground: () => isMobile() && document.visibilityState === 'hidden',
  })
  current = { key, provider }
  return provider
}

/** Frees the model now (Delete model, or Android memory pressure). */
export async function releaseOnDevice(): Promise<void> {
  const c = current
  current = null
  await c?.provider.unload()
}
