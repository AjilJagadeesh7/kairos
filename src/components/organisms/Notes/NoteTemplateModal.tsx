import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { BookOpen, CheckSquare, Lightbulb, Users, X, Zap, FileText, BarChart2, FlaskConical, GraduationCap, Bug, Globe } from 'lucide-react'
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
    description: 'Attendees, agenda, decisions, actions',
    icon: <Users size={18} />,
    title: 'Meeting — ',
    content: `## Date & Attendees
**Date:** ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
**Attendees:**

## Agenda
1.
2.

## Discussion & Decisions


## Action Items
| Task | Owner | Due |
|------|-------|-----|
| | | |

## Follow-up
`,
  },
  {
    id: 'project',
    name: 'Project Plan',
    description: 'Goal, milestones, tasks, risks',
    icon: <BarChart2 size={18} />,
    title: 'Project: ',
    content: `## Overview
**Goal:**
**Owner:**
**Target date:**

## Milestones
- [ ] **Phase 1 —**
- [ ] **Phase 2 —**
- [ ] **Phase 3 —**

## Tasks
- [ ]
- [ ]

## Risks & Mitigations
| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| | | |

## Resources & Links


## Notes
`,
  },
  {
    id: 'brainstorm',
    name: 'Brainstorm',
    description: 'Capture ideas, evaluate, decide',
    icon: <Lightbulb size={18} />,
    title: 'Brainstorm: ',
    content: `## Problem / Question


## Constraints
-

## Ideas
-
-
-
-

## Evaluation
| Idea | Pros | Cons |
|------|------|------|
| | | |

## Decision & Next Steps
`,
  },
  {
    id: 'book',
    name: 'Book Notes',
    description: 'Summary, key ideas, quotes, takeaways',
    icon: <BookOpen size={18} />,
    title: 'Book: ',
    content: `## Metadata
**Title:**
**Author:**
**Finished:**
**Rating:** ⭐⭐⭐⭐⭐

## In One Sentence


## Key Ideas
1.
2.
3.

## Favourite Quotes
>

>

## What I'll Apply
-

## Related Reading
-
`,
  },
  {
    id: 'todo',
    name: 'To-Do List',
    description: 'Prioritised task checklist',
    icon: <CheckSquare size={18} />,
    title: 'To-Do: ',
    content: `## High priority
- [ ]
- [ ]

## Medium priority
- [ ]
- [ ]

## Low priority / someday
- [ ]

## Done
`,
  },
  {
    id: 'standup',
    name: 'Daily Standup',
    description: 'Yesterday, today, blockers',
    icon: <Zap size={18} />,
    title: `Standup ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`,
    content: `## Yesterday
-

## Today
-

## Blockers
-

## Notes
`,
  },
  {
    id: 'research',
    name: 'Research Note',
    description: 'Topic, sources, findings, gaps',
    icon: <FlaskConical size={18} />,
    title: 'Research: ',
    content: `## Topic


## Background


## Sources
| Source | Key Finding | Credibility |
|--------|-------------|-------------|
| | | |

## Findings


## Open Questions
-

## Conclusion
`,
  },
  {
    id: 'learning',
    name: 'Study Notes',
    description: 'Concept, examples, review questions',
    icon: <GraduationCap size={18} />,
    title: 'Notes: ',
    content: `## Topic


## Core Concepts
### Concept 1


### Concept 2


## Examples
\`\`\`

\`\`\`

## Key Terms
| Term | Definition |
|------|-----------|
| | |

## Summary


## Review Questions
1.
2.
3.
`,
  },
  {
    id: 'bug',
    name: 'Bug Report',
    description: 'Steps to reproduce, expected vs actual',
    icon: <Bug size={18} />,
    title: 'Bug: ',
    content: `## Summary


## Environment
**Version:**
**OS / Browser:**

## Steps to Reproduce
1.
2.
3.

## Expected Behaviour


## Actual Behaviour


## Root Cause


## Fix / Workaround


## Related Issues
-
`,
  },
  {
    id: 'weekly',
    name: 'Weekly Review',
    description: 'Wins, lessons, goals for next week',
    icon: <Globe size={18} />,
    title: `Week of ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}`,
    content: `## Wins this week
-

## What didn't go well
-

## Lessons learned
-

## Metrics / Progress
| Metric | Target | Actual |
|--------|--------|--------|
| | | |

## Goals for next week
- [ ]
- [ ]
- [ ]

## Energy & mood


## Notes
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

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={handleBackdropClick}
    >
      <div
        ref={containerRef}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className="flex w-full max-w-3xl flex-col gap-5 rounded-2xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-6 shadow-2xl outline-none"
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
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 max-h-[60vh] overflow-y-auto pr-1">
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
    </div>,
    document.body,
  )
}
