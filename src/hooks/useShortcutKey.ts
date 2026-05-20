import { useAppStore } from '../store/useAppStore'
import { SHORTCUT_REGISTRY, matchesBinding } from '../shortcuts/registry'
import type { ShortcutId } from '../shortcuts/registry'

export function useShortcutKey(id: ShortcutId): string {
  const keyBindings = useAppStore(s => s.keyBindings)
  return keyBindings[id] ?? SHORTCUT_REGISTRY.find(s => s.id === id)?.defaultKey ?? ''
}

export function resolveShortcutKey(id: ShortcutId, keyBindings: Record<string, string>): string {
  return keyBindings[id] ?? SHORTCUT_REGISTRY.find(s => s.id === id)?.defaultKey ?? ''
}

export function eventMatchesAction(e: KeyboardEvent, id: ShortcutId, keyBindings: Record<string, string>): boolean {
  const binding = resolveShortcutKey(id, keyBindings)
  if (!binding) return false
  return matchesBinding(e, binding)
}
