import { useEffect } from 'react'

import { useAppStore } from '../../store/useAppStore'
import { SHORTCUT_REGISTRY, displayKey } from '../../shortcuts/registry'
import type { ShortcutContext } from '../../shortcuts/registry'
import { Icon } from '../../icons/Icon'

interface ShortcutsModalProps {
  onClose: () => void
}

const CONTEXT_ORDER: ShortcutContext[] = ['Global', 'Notes', 'Kanban', 'Journal']

export function ShortcutsModal({ onClose }: ShortcutsModalProps) {
  const keyBindings = useAppStore(s => s.keyBindings)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  // Only show shortcuts that have an effective binding (default or user-set)
  const grouped = CONTEXT_ORDER.map(ctx => ({
    context: ctx,
    shortcuts: SHORTCUT_REGISTRY.filter(s => s.context === ctx && (keyBindings[s.id] ?? s.defaultKey)),
  })).filter(g => g.shortcuts.length > 0)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--bg))] shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-[rgb(var(--border))] px-5 py-4">
          <Icon name="keyboard" size={16} className="text-[rgb(var(--accent))]" />
          <h2 className="flex-1 text-sm font-semibold text-[rgb(var(--text))]">Keyboard shortcuts</h2>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-[rgb(var(--text-3))] transition hover:bg-[rgb(var(--surface-2))] hover:text-[rgb(var(--text))]"
            aria-label="Close"
          >
            <Icon name="x" size={14} />
          </button>
        </div>

        <div className="divide-y divide-[rgb(var(--border))] p-2">
          {grouped.map(({ context, shortcuts }) => (
            <div key={context} className="py-3 first:pt-1">
              <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-[rgb(var(--text-3))]">
                {context}
              </p>
              <div className="space-y-0.5">
                {shortcuts.map(def => {
                  const key = keyBindings[def.id] ?? def.defaultKey
                  const isCustom = !!keyBindings[def.id] && keyBindings[def.id] !== def.defaultKey
                  return (
                    <div
                      key={def.id}
                      className="flex items-center justify-between rounded-lg px-3 py-1.5"
                    >
                      <span className="text-sm text-[rgb(var(--text-2))]">{def.label}</span>
                      <kbd className={`rounded px-2 py-0.5 font-mono text-xs ${
                        isCustom
                          ? 'border border-[rgb(var(--accent)/0.4)] bg-[rgb(var(--accent)/0.08)] text-[rgb(var(--accent))]'
                          : 'border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] text-[rgb(var(--text-2))]'
                      }`}>
                        {displayKey(key)}
                      </kbd>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-[rgb(var(--border))] px-5 py-3">
          <p className="text-[11px] text-[rgb(var(--text-3))]">
            Customize bindings in <span className="font-medium text-[rgb(var(--text-2))]">Settings → Keyboard</span>
          </p>
        </div>
      </div>
    </div>
  )
}
