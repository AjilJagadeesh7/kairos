/**
 * The on-device model as a provider entry: not user-added, always the same
 * id, selectable for a surface only in the Full build once its model file is
 * verified on disk. Its location is always "On-device".
 */
import { modelById } from './models'
import type { AiProviderConfig } from '../../types'

export const ON_DEVICE_PROVIDER_ID = 'on-device'
/** Not a network address: marks the on-device entry for the location badge. */
export const ON_DEVICE_URL = 'local://on-device'

export function onDeviceConfig(modelId: string, readyPath: string | null): AiProviderConfig | null {
  // A build-time constant, so Lite drops the model catalog along with this branch.
  if (__BUILD_FLAVOR__ !== 'full') return null
  const model = modelById(modelId)
  if (!model || !readyPath) return null
  return {
    id: ON_DEVICE_PROVIDER_ID, type: 'on-device', name: `On-device · ${model.label}`, baseUrl: ON_DEVICE_URL,
    model: model.id, verified: true, contextTokens: model.contextTokens, createdAt: '',
  }
}
