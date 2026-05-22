import { useState } from 'react'

import { useAppStore } from '../../../store/useAppStore'
import {
  DEFAULT_SHORTCUTS, EXTRA_SHORTCUTS, SHORTCUT_REGISTRY,
  displayKey, normalizeEventKey,
} from '../../../shortcuts/registry'
import { SectionCard } from '../../molecules/SectionCard'
import type { ShortcutContext } from '../../../shortcuts/registry'
import { Icon } from '../../../icons/Icon'

const CONTEXT_ORDER: ShortcutContext[] = ['Global', 'Notes', 'Kanban', 'Journal']

// ── Shared key-capture logic ──────────────────────────────────────────────────

function KeyCapture({ onCapture, onCancel }: { onCapture: (key: string) => void; onCancel: () => void }) {
  function handleKeyDown(e: React.KeyboardEvent) {
    e.preventDefault()
    e.nativeEvent.stopImmediatePropagation()
    const ignored = ['Control', 'Meta', 'Alt', 'Shift']
    if (ignored.includes(e.nativeEvent.key)) return
    const normalized = normalizeEventKey(e.nativeEvent)
    if (normalized === 'escape') { onCancel(); return }
    onCapture(normalized)
  }

  return (
    <input
      ref={el => el?.focus()}
      type="text"
      readOnly
      placeholder="Press a key…"
      className="min-w-[90px] rounded-md border border-[rgb(var(--accent))] bg-[rgb(var(--accent)/0.08)] px-2 py-1 text-center font-mono text-xs text-[rgb(var(--accent))] outline-none ring-1 ring-[rgb(var(--accent)/0.4)] placeholder:text-[rgb(var(--accent)/0.7)]"
      onKeyDown={handleKeyDown}
      onBlur={onCancel}
    />
  )
}

// ── Built-in shortcuts table ──────────────────────────────────────────────────

function BuiltinRow({ def }: { def: typeof DEFAULT_SHORTCUTS[number] }) {
  const keyBindings     = useAppStore(s => s.keyBindings)
  const setKeyBinding   = useAppStore(s => s.setKeyBinding)
  const resetKeyBinding = useAppStore(s => s.resetKeyBinding)
  const [recording, setRecording] = useState(false)

  const customKey  = keyBindings[def.id]
  const effectiveKey = customKey ?? def.defaultKey!
  const isCustom   = !!customKey && customKey !== def.defaultKey

  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <div>
        <span className="text-sm text-[rgb(var(--text))]">{def.label}</span>
        <span className="ml-2 rounded px-1 py-0.5 text-[10px] text-[rgb(var(--text-3))]">{def.context}</span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {isCustom && (
          <button type="button" onClick={() => resetKeyBinding(def.id)} title="Reset to default"
            className="flex h-6 w-6 items-center justify-center rounded text-[rgb(var(--text-3))] transition hover:text-[rgb(var(--accent))]">
            <Icon name="rotate-ccw" size={12} />
          </button>
        )}
        {recording ? (
          <KeyCapture onCapture={key => { setKeyBinding(def.id, key); setRecording(false) }} onCancel={() => setRecording(false)} />
        ) : (
          <button type="button" onClick={() => setRecording(true)} title="Click to remap"
            className={`min-w-[90px] rounded-md border px-2 py-1 font-mono text-xs transition hover:border-[rgb(var(--accent)/0.6)] hover:bg-[rgb(var(--accent)/0.05)] ${
              isCustom
                ? 'border-[rgb(var(--accent)/0.4)] bg-[rgb(var(--accent)/0.08)] text-[rgb(var(--accent))]'
                : 'border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] text-[rgb(var(--text-2))]'
            }`}>
            {displayKey(effectiveKey)}
          </button>
        )}
      </div>
    </div>
  )
}

// ── Custom (user-added) shortcut row ─────────────────────────────────────────

function CustomRow({ id }: { id: string }) {
  const keyBindings     = useAppStore(s => s.keyBindings)
  const setKeyBinding   = useAppStore(s => s.setKeyBinding)
  const resetKeyBinding = useAppStore(s => s.resetKeyBinding)
  const [recording, setRecording] = useState(false)

  const def        = SHORTCUT_REGISTRY.find(s => s.id === id)
  const boundKey   = keyBindings[id] ?? ''

  if (!def || !boundKey) return null

  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <div>
        <span className="text-sm text-[rgb(var(--text))]">{def.label}</span>
        <span className="ml-2 rounded px-1 py-0.5 text-[10px] text-[rgb(var(--text-3))]">{def.context}</span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {recording ? (
          <KeyCapture onCapture={key => { setKeyBinding(id, key); setRecording(false) }} onCancel={() => setRecording(false)} />
        ) : (
          <button type="button" onClick={() => setRecording(true)} title="Click to remap"
            className="min-w-[90px] rounded-md border border-[rgb(var(--accent)/0.4)] bg-[rgb(var(--accent)/0.08)] px-2 py-1 font-mono text-xs text-[rgb(var(--accent))] transition hover:border-[rgb(var(--accent)/0.6)] hover:bg-[rgb(var(--accent)/0.05)]">
            {displayKey(boundKey)}
          </button>
        )}
        <button type="button" onClick={() => resetKeyBinding(id)} title="Remove shortcut"
          className="flex h-6 w-6 items-center justify-center rounded text-[rgb(var(--text-3))] transition hover:text-red-400">
          <Icon name="trash-2" size={12} />
        </button>
      </div>
    </div>
  )
}

// ── Add-shortcut picker ───────────────────────────────────────────────────────

interface AddPickerProps {
  onClose: () => void
}

function AddPicker({ onClose }: AddPickerProps) {
  const keyBindings   = useAppStore(s => s.keyBindings)
  const setKeyBinding = useAppStore(s => s.setKeyBinding)
  const [selected, setSelected] = useState<string | null>(null)

  // Actions with no default key that the user hasn't already bound
  const available = EXTRA_SHORTCUTS.filter(def => !keyBindings[def.id])
  const grouped   = CONTEXT_ORDER.map(ctx => ({
    context: ctx,
    items: available.filter(d => d.context === ctx),
  })).filter(g => g.items.length > 0)

  function handleCapture(key: string) {
    if (!selected) return
    setKeyBinding(selected, key)
    onClose()
  }

  if (selected) {
    const def = SHORTCUT_REGISTRY.find(s => s.id === selected)!
    return (
      <div className="rounded-lg border border-[rgb(var(--accent)/0.3)] bg-[rgb(var(--accent)/0.04)] p-4">
        <div className="mb-3 flex items-center gap-2">
          <button type="button" onClick={() => setSelected(null)} className="text-[rgb(var(--text-3))] hover:text-[rgb(var(--text))]">
            <Icon name="x" size={14} />
          </button>
          <span className="text-xs text-[rgb(var(--text-2))]">
            Press a key for <span className="font-medium text-[rgb(var(--text))]">{def.label}</span>
          </span>
        </div>
        <KeyCapture onCapture={handleCapture} onCancel={() => setSelected(null)} />
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))]">
      <div className="flex items-center justify-between border-b border-[rgb(var(--border))] px-4 py-2">
        <span className="text-xs font-medium text-[rgb(var(--text))]">Pick an action</span>
        <button type="button" onClick={onClose} className="text-[rgb(var(--text-3))] hover:text-[rgb(var(--text))]">
          <Icon name="x" size={14} />
        </button>
      </div>
      {available.length === 0 ? (
        <p className="px-4 py-4 text-xs text-[rgb(var(--text-3))]">All available actions are already bound.</p>
      ) : (
        <div className="divide-y divide-[rgb(var(--border))]">
          {grouped.map(({ context, items }) => (
            <div key={context} className="py-2">
              <p className="px-4 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-widest text-[rgb(var(--text-3))]">
                {context}
              </p>
              {items.map(def => (
                <button
                  key={def.id}
                  type="button"
                  onClick={() => setSelected(def.id)}
                  className="flex w-full items-center justify-between px-4 py-2 text-sm text-[rgb(var(--text-2))] transition hover:bg-[rgb(var(--surface-2))] hover:text-[rgb(var(--text))]"
                >
                  {def.label}
                </button>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main section ─────────────────────────────────────────────────────────────

export function KeyboardSection() {
  const keyBindings = useAppStore(s => s.keyBindings)
  const [showPicker, setShowPicker] = useState(false)

  // User-added bindings for extra (non-default) actions
  const customIds = EXTRA_SHORTCUTS.map(d => d.id).filter(id => keyBindings[id])

  return (
    <div className="space-y-4">
      <SectionCard title="Built-in shortcuts">
        <p className="mb-4 text-xs text-[rgb(var(--text-2))]">
          Click any binding to record a new key. Press{' '}
          <kbd className="rounded border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] px-1 font-mono text-[10px]">Esc</kbd> to cancel.
        </p>
        <div className="overflow-hidden rounded-lg border border-[rgb(var(--border))]">
          {DEFAULT_SHORTCUTS.map((def, i) => (
            <div key={def.id} className={i > 0 ? 'border-t border-[rgb(var(--border))]' : ''}>
              <BuiltinRow def={def} />
            </div>
          ))}
        </div>
      </SectionCard>

      <SectionCard title="Custom shortcuts">
        <p className="mb-4 text-xs text-[rgb(var(--text-2))]">
          Add shortcuts for additional actions across Notes, Kanban, Journal, and navigation.
        </p>

        {customIds.length > 0 && (
          <div className="mb-4 overflow-hidden rounded-lg border border-[rgb(var(--border))]">
            {customIds.map((id, i) => (
              <div key={id} className={i > 0 ? 'border-t border-[rgb(var(--border))]' : ''}>
                <CustomRow id={id} />
              </div>
            ))}
          </div>
        )}

        {showPicker ? (
          <AddPicker onClose={() => setShowPicker(false)} />
        ) : (
          <button
            type="button"
            onClick={() => setShowPicker(true)}
            className="flex items-center gap-2 rounded-lg border border-dashed border-[rgb(var(--border))] px-4 py-2.5 text-sm text-[rgb(var(--text-3))] transition hover:border-[rgb(var(--accent)/0.5)] hover:text-[rgb(var(--accent))]"
          >
            <Icon name="plus" size={14} />
            Add shortcut
          </button>
        )}
      </SectionCard>
    </div>
  )
}
