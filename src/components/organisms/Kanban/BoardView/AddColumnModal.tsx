import { useEffect, useRef, useState } from 'react'

import { ColorPicker } from '../../../molecules/ColorPicker'
import { Button } from '../../../atoms/Button'
import { IconButton } from '../../../atoms/IconButton'

const PALETTE = [
  '#ef4444', '#f97316', '#f59e0b', '#eab308',
  '#84cc16', '#22c55e', '#10b981', '#14b8a6',
  '#06b6d4', '#3b82f6', '#6366f1', '#8b5cf6',
  '#a855f7', '#ec4899', '#f43f5e', '#64748b',
]

interface AddColumnModalProps {
  onConfirm: (name: string, color: string) => void
  onClose: () => void
  defaultColor?: string
}

export function AddColumnModal({ onConfirm, onClose, defaultColor }: AddColumnModalProps): JSX.Element {
  const [name, setName] = useState('')
  const [color, setColor] = useState(defaultColor ?? PALETTE[0])
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { inputRef.current?.focus() }, [])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    onConfirm(trimmed, color)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative z-10 w-80 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-5 shadow-2xl">

        {/* Header */}
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[rgb(var(--text))]">New column</h2>
          <IconButton icon="x" label="Close" size="sm" onClick={onClose} />
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* Name */}
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[rgb(var(--text-3))]">
              Column name
            </label>
            <input
              ref={inputRef}
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Escape' && onClose()}
              placeholder="e.g. In Review"
              className="w-full rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] px-3 py-2 text-sm text-[rgb(var(--text))] outline-none focus:border-[rgb(var(--accent))]"
            />
          </div>

          {/* Color */}
          <div>
            <div className="mb-2 flex items-center gap-2">
              <label className="text-xs font-medium text-[rgb(var(--text-3))]">Accent color</label>
              <span
                className="h-4 w-4 rounded-full border-2 border-white/20"
                style={{ backgroundColor: color }}
              />
            </div>
            <ColorPicker value={color} onChange={setColor} palette={PALETTE} cols={8} />
          </div>

          {/* Preview */}
          <div
            className="rounded-lg border-t-4 bg-[rgb(var(--surface-2))] px-3 py-2 text-xs text-[rgb(var(--text-2))]"
            style={{ borderColor: color }}
          >
            {name.trim() || <span className="text-[rgb(var(--text-3))]">Column preview</span>}
          </div>

          {/* Actions */}
          <div className="flex gap-2">
            <Button variant="hollow" size="md" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button variant="submit" size="md" className="flex-1" disabled={!name.trim()}>
              Add column
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
