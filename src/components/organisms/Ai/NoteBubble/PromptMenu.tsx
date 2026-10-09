import { useEffect, useRef, useState } from 'react'
import { Button } from '../../../atoms/Button'
import { IconButton } from '../../../atoms/IconButton'
import { Icon } from '../../../../icons/Icon'
import { useAiStore } from '../../../../store/useAiStore'
import { NOTE_PRESETS, PRESET_GROUPS, type NotePreset } from './notePresets'
import { keepSelection } from './keepSelection'
import type { BubblePrompt } from '../../../../types'


const STARTERS = ['summary', 'key-points', 'simplify', 'next-steps']

/** A few suggested first actions, shown while the conversation is empty. */
export function PromptStarters({ disabled, onPreset, onMore }: { disabled: boolean; onPreset: (p: NotePreset) => void; onMore: () => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {NOTE_PRESETS.filter((p) => STARTERS.includes(p.id)).map((p) => (
        <Button key={p.id} variant="hollow" size="sm" disabled={disabled} onMouseDown={keepSelection} onClick={() => onPreset(p)}>
          <Icon name={p.icon} size={13} className="text-text3" /> {p.label}
        </Button>
      ))}
      <Button variant="ghost" size="sm" onMouseDown={keepSelection} onClick={onMore}>
        <Icon name="more-horizontal" size={13} /> More prompts
      </Button>
    </div>
  )
}

interface MenuProps {
  disabled: boolean
  onPreset: (preset: NotePreset) => void
  onPrompt: (prompt: BubblePrompt) => void
  onClose: () => void
}

/**
 * The full prompt menu, floating above the composer: presets by group, the
 * user's own prompts, and a form to add one. Edit presets work on the
 * selection, or the whole note when nothing is selected.
 */
export function PromptMenuPanel({ disabled, onPreset, onPrompt, onClose }: MenuProps) {
  const prompts = useAiStore((s) => s.bubblePrompts)
  const addPrompt = useAiStore((s) => s.addBubblePrompt)
  const removePrompt = useAiStore((s) => s.removeBubblePrompt)
  const [adding, setAdding] = useState(false)
  const [label, setLabel] = useState('')
  const [instruction, setInstruction] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  // Escape or a click outside closes the menu (not the bubble). Focus usually
  // stays in the editor (to keep the selection), so listen on the window, first.
  useEffect(() => {
    const down = (e: MouseEvent) => {
      const t = e.target as HTMLElement
      if (!ref.current?.contains(t) && !t.closest('[data-prompt-toggle]')) onClose()
    }
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      e.preventDefault()
      onClose()
    }
    document.addEventListener('mousedown', down)
    window.addEventListener('keydown', key, true)
    return () => {
      document.removeEventListener('mousedown', down)
      window.removeEventListener('keydown', key, true)
    }
  }, [onClose])

  const pick = (fn: () => void) => { onClose(); fn() }
  const save = () => {
    if (!instruction.trim()) return
    addPrompt(label, instruction)
    setLabel('')
    setInstruction('')
    setAdding(false)
  }

  return (
    <div
      ref={ref} role="menu" aria-label="Prompts"
      className="absolute inset-x-2.5 bottom-full z-10 mb-1 max-h-80 space-y-3 overflow-y-auto rounded-xl border border-border bg-surface p-2.5 shadow-xl"
    >
      {PRESET_GROUPS.map((g) => (
        <div key={g}>
          <p className="mb-1 px-1 text-[10px] font-medium uppercase tracking-wider text-text3">{g}{g === 'Edit' ? ' · selection or whole note' : ''}</p>
          <div className="grid grid-cols-2 gap-0.5">
            {NOTE_PRESETS.filter((p) => p.group === g).map((p) => (
              <Button key={p.id} role="menuitem" variant="ghost" size="sm" className="!justify-start" disabled={disabled} onMouseDown={keepSelection} onClick={() => pick(() => onPreset(p))}>
                <Icon name={p.icon} size={13} className="text-text3" /> {p.label}
              </Button>
            ))}
          </div>
        </div>
      ))}
      <div>
        <p className="mb-1 px-1 text-[10px] font-medium uppercase tracking-wider text-text3">My prompts</p>
        <div className="flex flex-wrap gap-1">
          {prompts.map((p) => (
            <span key={p.id} className="flex items-center rounded-md border border-border/70">
              <Button role="menuitem" variant="ghost" size="xs" disabled={disabled} title={p.instruction} onMouseDown={keepSelection} onClick={() => pick(() => onPrompt(p))}>
                <Icon name="bookmark" size={12} /> {p.label}
              </Button>
              <IconButton icon="x" size="xs" label={`Delete prompt ${p.label}`} onClick={() => removePrompt(p.id)} />
            </span>
          ))}
          {!adding && (
            <Button variant="ghost" size="xs" onClick={() => setAdding(true)}><Icon name="plus" size={12} /> New prompt</Button>
          )}
        </div>
        {adding && (
          <div className="mt-1.5 space-y-1.5">
            <input
              value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Name, e.g. Meeting recap"
              className="w-full rounded-md border border-border bg-surface2 px-2 py-1 text-[12px] text-text outline-none focus:border-text2"
            />
            <textarea
              value={instruction} onChange={(e) => setInstruction(e.target.value)} rows={3}
              placeholder="What it should do, e.g. Rewrite this as a meeting recap with decisions and owners"
              className="w-full resize-none rounded-md border border-border bg-surface2 px-2 py-1 text-[12px] text-text outline-none focus:border-text2"
            />
            <div className="flex gap-1.5">
              <Button variant="primary" size="xs" disabled={!instruction.trim()} onClick={save}>Save prompt</Button>
              <Button variant="ghost" size="xs" onClick={() => setAdding(false)}>Cancel</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/** The composer's prompt-menu toggle. */
export function PromptMenuToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <IconButton
      icon="sparkles" label="All prompts" title="Prompts" size="sm" data-prompt-toggle aria-expanded={open}
      onMouseDown={keepSelection} onClick={onToggle} className={open ? 'bg-surface3 text-text' : ''}
    />
  )
}
