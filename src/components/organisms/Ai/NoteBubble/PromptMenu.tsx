import { useState } from 'react'
import { Button } from '../../../atoms/Button'
import { IconButton } from '../../../atoms/IconButton'
import { Icon } from '../../../../icons/Icon'
import { useAiStore } from '../../../../store/useAiStore'
import { NOTE_PRESETS, PRESET_GROUPS, type NotePreset } from './notePresets'
import type { BubblePrompt } from '../../../../types'

interface Props {
  disabled: boolean
  onPreset: (preset: NotePreset) => void
  onPrompt: (prompt: BubblePrompt) => void
}

/** Keeps the editor's selection: a mousedown on these must not move focus. */
const keepSelection = (e: React.MouseEvent) => e.preventDefault()

const QUICK = ['summary', 'explain', 'continue', 'tasks']

/**
 * The note bubble's prompt menu: a few common actions in a row, and the full
 * list — presets by group, the user's own prompts, and a form to add one.
 * Edit presets work on the selection, or the whole note when nothing is selected.
 */
export function PromptMenu({ disabled, onPreset, onPrompt }: Props) {
  const prompts = useAiStore((s) => s.bubblePrompts)
  const addPrompt = useAiStore((s) => s.addBubblePrompt)
  const removePrompt = useAiStore((s) => s.removeBubblePrompt)
  const [open, setOpen] = useState(false)
  const [adding, setAdding] = useState(false)
  const [label, setLabel] = useState('')
  const [instruction, setInstruction] = useState('')

  const pick = (fn: () => void) => { setOpen(false); fn() }
  const save = () => {
    if (!instruction.trim()) return
    addPrompt(label, instruction)
    setLabel('')
    setInstruction('')
    setAdding(false)
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap gap-1">
        {NOTE_PRESETS.filter((p) => QUICK.includes(p.id)).map((p) => (
          <Button key={p.id} variant="hollow" size="xs" disabled={disabled} onMouseDown={keepSelection} onClick={() => onPreset(p)}>
            <Icon name={p.icon} size={12} /> {p.label}
          </Button>
        ))}
        <Button variant="hollow" size="xs" onMouseDown={keepSelection} onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          <Icon name={open ? 'chevron-up' : 'more-horizontal'} size={12} /> All prompts
        </Button>
      </div>

      {open && (
        <div role="menu" aria-label="Prompts" className="max-h-72 space-y-2 overflow-y-auto rounded-lg border border-border bg-surface p-2">
          {PRESET_GROUPS.map((g) => (
            <div key={g}>
              <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-text3">{g}{g === 'Edit' ? ' · selection or whole note' : ''}</p>
              <div className="flex flex-wrap gap-1">
                {NOTE_PRESETS.filter((p) => p.group === g).map((p) => (
                  <Button key={p.id} role="menuitem" variant="ghost" size="xs" disabled={disabled} onMouseDown={keepSelection} onClick={() => pick(() => onPreset(p))}>
                    <Icon name={p.icon} size={12} /> {p.label}
                  </Button>
                ))}
              </div>
            </div>
          ))}
          <div>
            <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-text3">My prompts</p>
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
      )}
    </div>
  )
}
