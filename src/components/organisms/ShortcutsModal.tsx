import { useEffect } from 'react'

import { useAppStore } from '../../store/useAppStore'
import { SHORTCUT_REGISTRY, displayKey } from '../../shortcuts/registry'
import type { ShortcutContext } from '../../shortcuts/registry'
import { Icon } from '../../icons/Icon'
import { IconButton } from '../atoms/IconButton'
import { SectionLabel } from '../atoms/SectionLabel'
import { KbdKey } from '../atoms/KbdKey'
import { ModalShell } from '../molecules/ModalShell'

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
    <ModalShell onClose={onClose}>
        <div className="flex items-center gap-2 border-b border-[rgb(var(--border))] px-5 py-4">
          <Icon name="keyboard" size={16} className="text-[rgb(var(--accent))]" />
          <h2 className="flex-1 text-sm font-semibold text-[rgb(var(--text))]">Keyboard shortcuts</h2>
          <IconButton icon="x" label="Close" size="sm" onClick={onClose} />
        </div>

        <div className="divide-y divide-[rgb(var(--border))] p-2">
          {grouped.map(({ context, shortcuts }) => (
            <div key={context} className="py-3 first:pt-1">
              <SectionLabel className="mb-2 px-3">{context}</SectionLabel>
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
                      <KbdKey className={isCustom
                        ? 'border-[rgb(var(--accent)/0.4)] bg-[rgb(var(--accent)/0.08)] text-[rgb(var(--accent))]'
                        : 'text-text2'}>
                        {displayKey(key)}
                      </KbdKey>
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
    </ModalShell>
  )
}
