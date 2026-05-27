import type { AppEvent } from './types'

type HandlerSet = Set<(payload: unknown) => void>
const _eventMap = new Map<AppEvent, HandlerSet>()

export function busOn(event: AppEvent, handler: (payload: unknown) => void): void {
  if (!_eventMap.has(event)) _eventMap.set(event, new Set())
  _eventMap.get(event)!.add(handler)
}

export function busOff(event: AppEvent, handler: (payload: unknown) => void): void {
  _eventMap.get(event)?.delete(handler)
}

export function emitEvent(event: AppEvent, payload?: unknown): void {
  _eventMap.get(event)?.forEach(fn => {
    try { fn(payload) }
    catch (e) { console.warn(`[plugins] handler error in "${event}":`, e) }
  })
}
