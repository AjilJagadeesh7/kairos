import { useState, useRef, useEffect } from 'react'
import Picker from '@emoji-mart/react'
import data from '@emoji-mart/data'
import { useAppStore } from '../../../store/useAppStore'
import { SectionCard } from '../../molecules/SectionCard'
import { Icon } from '../../../icons/Icon'
import type { CustomCallout } from '../../../types'

const CALLOUT_TYPES = [
  { type: 'note',      label: 'Note',      aliases: 'INFO',            emoji: 'ℹ️',  default: '#3b82f6' },
  { type: 'tip',       label: 'Tip',       aliases: 'HINT, SUCCESS',   emoji: '💡',  default: '#22c55e' },
  { type: 'important', label: 'Important', aliases: '',                 emoji: '📌',  default: '#a855f7' },
  { type: 'warning',   label: 'Warning',   aliases: 'CAUTION',         emoji: '⚠️',  default: '#eab308' },
  { type: 'danger',    label: 'Danger',    aliases: 'BUG, ERROR',      emoji: '🔥',  default: '#ef4444' },
  { type: 'example',   label: 'Example',   aliases: '',                 emoji: '📋',  default: '#6366f1' },
  { type: 'quote',     label: 'Quote',     aliases: 'CITE',            emoji: '💬',  default: '#94a3b8' },
  { type: 'abstract',  label: 'Abstract',  aliases: 'SUMMARY, TLDR',  emoji: '📝',  default: '#14b8a6' },
] as const

const EMPTY_FORM: Omit<CustomCallout, 'type'> & { type: string } = {
  type: '', label: '', emoji: '✨', color: '#6366f1',
}

function EmojiPickerButton({
  value, onChange,
}: { value: string; onChange: (emoji: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        title="Pick emoji"
        onClick={() => setOpen(v => !v)}
        className="flex h-9 w-9 items-center justify-center rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--surface-3))] text-xl transition hover:bg-[rgb(var(--surface-2))]"
      >
        {value}
      </button>
      {open && (
        <div className="absolute left-0 top-full z-50 mt-1">
          <Picker
            data={data}
            onEmojiSelect={(e: { native: string }) => { onChange(e.native); setOpen(false) }}
            theme="auto"
            previewPosition="none"
            skinTonePosition="none"
          />
        </div>
      )}
    </div>
  )
}

function ColorPicker({
  color, onChange, label,
}: { color: string; onChange: (c: string) => void; label: string }) {
  return (
    <label
      title={`Pick color for ${label}`}
      className="relative flex h-7 w-7 cursor-pointer items-center justify-center overflow-hidden rounded-md border-2 transition hover:scale-110"
      style={{ borderColor: color, backgroundColor: color + '28' }}
    >
      <input
        type="color"
        value={color}
        onChange={e => onChange(e.target.value)}
        className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        aria-label={`Color for ${label} callout`}
      />
      <span className="text-[10px]">🎨</span>
    </label>
  )
}

export function CalloutsSection() {
  const calloutColors      = useAppStore(s => s.calloutColors)
  const setCalloutColor    = useAppStore(s => s.setCalloutColor)
  const resetCalloutColor  = useAppStore(s => s.resetCalloutColor)
  const customCallouts     = useAppStore(s => s.customCallouts)
  const addCustomCallout   = useAppStore(s => s.addCustomCallout)
  const removeCustomCallout = useAppStore(s => s.removeCustomCallout)
  const updateCustomCallout = useAppStore(s => s.updateCustomCallout)

  const [form, setForm] = useState(EMPTY_FORM)
  const [formError, setFormError] = useState('')

  const allBuiltinTypes = new Set<string>(CALLOUT_TYPES.map(c => c.type))

  function handleAdd() {
    const type = form.type.trim().toLowerCase().replace(/\s+/g, '-')
    if (!type) { setFormError('Type name is required'); return }
    if (!form.label.trim()) { setFormError('Label is required'); return }
    if (!form.emoji.trim()) { setFormError('Emoji is required'); return }
    if (allBuiltinTypes.has(type)) { setFormError(`"${type}" is a built-in callout type`); return }
    if (customCallouts.some(c => c.type === type)) { setFormError(`"${type}" already exists`); return }
    addCustomCallout({ type, label: form.label.trim(), emoji: form.emoji.trim(), color: form.color })
    setForm(EMPTY_FORM)
    setFormError('')
  }

  return (
    <div className="space-y-6">

      {/* How to use */}
      <SectionCard title="Callout Blocks">
        <p className="mb-3 text-sm text-[rgb(var(--text-2))]">
          Use Obsidian-style callouts anywhere in your notes with the syntax{' '}
          <code className="rounded bg-[rgb(var(--surface-2))] px-1.5 py-0.5 font-mono text-xs text-[rgb(var(--accent))]">
            {'> [!TYPE] Optional title'}
          </code>
        </p>
        <div className="space-y-1.5">
          {CALLOUT_TYPES.map(c => (
            <div key={c.type} className="flex items-center gap-2.5 text-xs">
              <span className="text-base leading-none">{c.emoji}</span>
              <code className="w-20 shrink-0 font-mono text-[rgb(var(--accent))]">[!{c.label.toUpperCase()}]</code>
              {c.aliases && (
                <span className="text-[rgb(var(--text-3))]">
                  aliases: {c.aliases.split(', ').map(a => (
                    <code key={a} className="mx-0.5 rounded bg-[rgb(var(--surface-2))] px-1 font-mono text-[rgb(var(--text-2))]">{a}</code>
                  ))}
                </span>
              )}
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-[rgb(var(--text-3))]">
          Custom title example:{' '}
          <code className="rounded bg-[rgb(var(--surface-2))] px-1.5 font-mono text-[rgb(var(--text-2))]">
            {'> [!NOTE] My custom title'}
          </code>
        </p>
      </SectionCard>

      {/* Built-in color customization */}
      <SectionCard title="Colors">
        <p className="mb-4 text-sm text-[rgb(var(--text-2))]">
          Override the accent color for each callout type. Changes apply instantly in all open notes.
        </p>

        <div className="space-y-2">
          {CALLOUT_TYPES.map(c => {
            const activeColor = calloutColors[c.type] ?? c.default
            const isCustom    = Boolean(calloutColors[c.type])

            return (
              <div
                key={c.type}
                className="flex items-center gap-3 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] px-3 py-2.5"
              >
                <div className="h-8 w-1 shrink-0 rounded-full" style={{ background: activeColor }} />
                <span className="text-base leading-none">{c.emoji}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-[rgb(var(--text))]">{c.label}</p>
                  {c.aliases && <p className="text-[10px] text-[rgb(var(--text-3))]">{c.aliases}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <ColorPicker color={activeColor} onChange={hex => setCalloutColor(c.type, hex)} label={c.label} />
                  <span className="w-[58px] font-mono text-[11px] text-[rgb(var(--text-3))]">
                    {activeColor.toUpperCase()}
                  </span>
                  {isCustom && (
                    <button
                      type="button"
                      title="Reset to default color"
                      onClick={() => resetCalloutColor(c.type)}
                      className="rounded p-1 text-[rgb(var(--text-3))] transition hover:bg-[rgb(var(--surface-3))] hover:text-[rgb(var(--text))]"
                    >
                      <Icon name="rotate-ccw" size={12} />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </SectionCard>

      {/* Custom callouts */}
      <SectionCard title="Custom Callouts">
        <p className="mb-4 text-sm text-[rgb(var(--text-2))]">
          Define your own callout types with a unique name, emoji, and color.
          Use them in notes with{' '}
          <code className="rounded bg-[rgb(var(--surface-2))] px-1.5 font-mono text-xs text-[rgb(var(--accent))]">
            {'> [!YOUR-TYPE]'}
          </code>
        </p>

        {/* Add form */}
        <div className="mb-4 space-y-3 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] p-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-[rgb(var(--text-3))]">New Callout</p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-xs text-[rgb(var(--text-3))]">Type name</label>
              <input
                type="text"
                placeholder="e.g. recipe"
                value={form.type}
                onChange={e => { setForm(f => ({ ...f, type: e.target.value })); setFormError('') }}
                className="w-full rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--surface-3))] px-2.5 py-1.5 text-sm text-[rgb(var(--text))] placeholder:text-[rgb(var(--text-3))] focus:outline-none focus:ring-1 focus:ring-[rgb(var(--accent))]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-[rgb(var(--text-3))]">Label</label>
              <input
                type="text"
                placeholder="e.g. Recipe"
                value={form.label}
                onChange={e => { setForm(f => ({ ...f, label: e.target.value })); setFormError('') }}
                className="w-full rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--surface-3))] px-2.5 py-1.5 text-sm text-[rgb(var(--text))] placeholder:text-[rgb(var(--text-3))] focus:outline-none focus:ring-1 focus:ring-[rgb(var(--accent))]"
              />
            </div>
          </div>
          <div className="flex items-end gap-3">
            <div>
              <label className="mb-1 block text-xs text-[rgb(var(--text-3))]">Emoji</label>
              <EmojiPickerButton value={form.emoji} onChange={emoji => setForm(f => ({ ...f, emoji }))} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-[rgb(var(--text-3))]">Color</label>
              <div className="flex items-center gap-2">
                <ColorPicker color={form.color} onChange={hex => setForm(f => ({ ...f, color: hex }))} label="new callout" />
                <span className="font-mono text-[11px] text-[rgb(var(--text-3))]">{form.color.toUpperCase()}</span>
              </div>
            </div>
            <div className="flex-1" />
            <button
              type="button"
              onClick={handleAdd}
              className="flex items-center gap-1.5 rounded-lg bg-[rgb(var(--accent))] px-3 py-1.5 text-sm font-medium text-[rgb(var(--accent-fg))] transition hover:opacity-90"
            >
              <Icon name="plus" size={14} />
              Add
            </button>
          </div>
          {formError && (
            <p className="text-xs text-red-400">{formError}</p>
          )}
        </div>

        {/* Existing custom callouts */}
        {customCallouts.length === 0 ? (
          <p className="text-center text-sm text-[rgb(var(--text-3))]">No custom callouts yet.</p>
        ) : (
          <div className="space-y-2">
            {customCallouts.map(c => {
              const activeColor = calloutColors[c.type] ?? c.color
              return (
                <div
                  key={c.type}
                  className="flex items-center gap-3 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] px-3 py-2.5"
                >
                  <div className="h-8 w-1 shrink-0 rounded-full" style={{ background: activeColor }} />
                  <EmojiPickerButton value={c.emoji} onChange={emoji => updateCustomCallout(c.type, { emoji })} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[rgb(var(--text))]">{c.label}</p>
                    <p className="font-mono text-[10px] text-[rgb(var(--text-3))]">[!{c.type.toUpperCase()}]</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <ColorPicker
                      color={activeColor}
                      onChange={hex => setCalloutColor(c.type, hex)}
                      label={c.label}
                    />
                    <span className="w-[58px] font-mono text-[11px] text-[rgb(var(--text-3))]">
                      {activeColor.toUpperCase()}
                    </span>
                    <button
                      type="button"
                      title="Delete custom callout"
                      onClick={() => removeCustomCallout(c.type)}
                      className="rounded p-1 text-[rgb(var(--text-3))] transition hover:bg-red-500/10 hover:text-red-400"
                    >
                      <Icon name="trash-2" size={13} />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </SectionCard>

    </div>
  )
}
