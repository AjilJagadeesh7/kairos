import { useEffect, useRef, useState } from 'react'

import { Button } from '../../atoms/Button'
import { Icon } from '../../../icons/Icon'
import { ModalShell } from '../../molecules/ModalShell'
import { IconButton } from '../../atoms/IconButton'
import type { NoteTemplate } from '../../../types'
import { makeTemplates } from './noteTemplates'

interface NoteTemplateModalProps {
  onSelect: (template: NoteTemplate) => void
  onClose: () => void
}

export function NoteTemplateModal({ onSelect, onClose }: NoteTemplateModalProps) {
  const templates = makeTemplates()
  const [selected, setSelected] = useState<string>('blank')
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    containerRef.current?.focus()
  }, [])

  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === e.currentTarget) onClose()
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') onClose()
    if (e.key === 'Enter') {
      const t = templates.find(t => t.id === selected)
      if (t) onSelect(t)
    }
  }

  function handleCreate() {
    const t = templates.find(t => t.id === selected)
    if (t) onSelect(t)
  }

  return (
    <ModalShell onClose={onClose} maxWidth="max-w-3xl" className="rounded-2xl p-6">
      <div
        ref={containerRef}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className="flex flex-col gap-5 outline-none"
      >
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-text">New note</h2>
            <p className="mt-0.5 text-xs text-text3">Choose a template to get started</p>
          </div>
          <IconButton icon="x" label="Close" size="sm" onClick={onClose} />
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 max-h-[60vh] overflow-y-auto pr-1">
          {templates.map(t => {
            const isSelected = selected === t.id
            return (
              <button
                key={t.id}
                onClick={() => setSelected(t.id)}
                onDoubleClick={() => onSelect(t)}
                className={`flex flex-col gap-2 rounded-xl border p-3 text-left transition ${
                  isSelected
                    ? 'border-[rgb(var(--accent))] bg-[rgb(var(--accent)/0.08)] ring-1 ring-[rgb(var(--accent)/0.3)]'
                    : 'border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] hover:border-[rgb(var(--accent)/0.5)]'
                }`}
              >
                <span className={isSelected ? 'text-[rgb(var(--accent))]' : 'text-[rgb(var(--text-2))]'}>
                  {t.icon}
                </span>
                <div>
                  <p className={`text-xs font-semibold ${isSelected ? 'text-[rgb(var(--accent))]' : 'text-[rgb(var(--text))]'}`}>
                    {t.name}
                  </p>
                  <p className="mt-0.5 text-[11px] leading-snug text-[rgb(var(--text-3))]">{t.description}</p>
                </div>
              </button>
            )
          })}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[rgb(var(--border))] pt-4">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="primary" size="sm" onClick={handleCreate}>
            Create note
          </Button>
        </div>
      </div>
    </ModalShell>
  )
}
