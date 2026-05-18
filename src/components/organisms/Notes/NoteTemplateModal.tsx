import { useEffect, useRef, useState } from 'react'
import { BookOpen, CheckSquare, Lightbulb, Users, X, Zap, FileText, BarChart2 } from 'lucide-react'
import { Button } from '../../atoms/Button'

export interface NoteTemplate {
  id: string
  name: string
  description: string
  icon: React.ReactNode
  title: string
  content: string
}

const TEMPLATES: NoteTemplate[] = [
  {
    id: 'blank',
    name: 'Blank',
    description: 'Start with an empty note',
    icon: <FileText size={18} />,
    title: '',
    content: '',
  },
  {
    id: 'meeting',
    name: 'Meeting Notes',
    description: 'Attendees, agenda, action items',
    icon: <Users size={18} />,
    title: 'Meeting Notes — ',
    content: `## Attendees
-

## Agenda
1.

## Notes


## Action Items
- [ ]
`,
  },
  {
    id: 'project',
    name: 'Project Plan',
    description: 'Goal, milestones, risks',
    icon: <BarChart2 size={18} />,
    title: 'Project: ',
    content: `## Goal


## Milestones
- [ ]
- [ ]
- [ ]

## Tasks
- [ ]

## Risks & Mitigations


## Notes
`,
  },
  {
    id: 'brainstorm',
    name: 'Brainstorm',
    description: 'Capture ideas fast',
    icon: <Lightbulb size={18} />,
    title: 'Brainstorm: ',
    content: `## Problem / Question


## Ideas
-
-
-

## Best bets


## Next steps
`,
  },
  {
    id: 'book',
    name: 'Book Notes',
    description: 'Summary, quotes, takeaways',
    icon: <BookOpen size={18} />,
    title: 'Book: ',
    content: `## Book
**Title:**
**Author:**
**Read:**

## Summary


## Key Ideas
-

## Favourite Quotes
>

## Takeaways
-
`,
  },
  {
    id: 'todo',
    name: 'To-Do List',
    description: 'Simple checklist',
    icon: <CheckSquare size={18} />,
    title: 'To-Do: ',
    content: `## Tasks
- [ ]
- [ ]
- [ ]

## Done
`,
  },
  {
    id: 'standup',
    name: 'Daily Standup',
    description: 'Did, doing, blockers',
    icon: <Zap size={18} />,
    title: 'Standup — ',
    content: `## Yesterday
-

## Today
-

## Blockers
-
`,
  },
]

interface NoteTemplateModalProps {
  onSelect: (template: NoteTemplate) => void
  onClose: () => void
}

export function NoteTemplateModal({ onSelect, onClose }: NoteTemplateModalProps) {
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
      const t = TEMPLATES.find(t => t.id === selected)
      if (t) onSelect(t)
    }
  }

  function handleCreate() {
    const t = TEMPLATES.find(t => t.id === selected)
    if (t) onSelect(t)
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={handleBackdropClick}
    >
      <div
        ref={containerRef}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className="flex w-full max-w-2xl flex-col gap-5 rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-6 shadow-2xl outline-none"
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-base font-semibold text-[rgb(var(--text))]">New note</h2>
            <p className="mt-0.5 text-xs text-[rgb(var(--text-3))]">Choose a template to get started</p>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-[rgb(var(--text-3))] transition hover:bg-[rgb(var(--surface-2))] hover:text-[rgb(var(--text))]"
          >
            <X size={15} />
          </button>
        </div>

        {/* Template grid */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {TEMPLATES.map(t => {
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

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-[rgb(var(--border))] pt-4">
          <Button variant="ghost" size="sm" onClick={onClose}>Cancel</Button>
          <Button variant="primary" size="sm" onClick={handleCreate}>
            Create note
          </Button>
        </div>
      </div>
    </div>
  )
}
