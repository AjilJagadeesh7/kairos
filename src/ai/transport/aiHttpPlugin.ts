import { registerPlugin, type PluginListenerHandle } from '@capacitor/core'
import type { NativeHttpEvent } from './httpStream'

/**
 * Bridge to the local Android `AiHttp` plugin
 * (android/app/src/main/java/com/kairos/app/AiHttpPlugin.java): streaming HTTP
 * for AI providers, body delivered as `event` notifications.
 */
export interface AiHttpPlugin {
  start(options: {
    id: string
    url: string
    method: string
    headers: Record<string, string>
    body?: string
  }): Promise<void>
  abort(options: { id: string }): Promise<void>
  addListener(
    eventName: 'event',
    listener: (event: NativeHttpEvent & { id: string }) => void,
  ): Promise<PluginListenerHandle>
}

export const AiHttp = registerPlugin<AiHttpPlugin>('AiHttp')
