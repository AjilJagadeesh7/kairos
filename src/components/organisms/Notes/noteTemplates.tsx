import { Icon } from '../../../icons/Icon'
import type { NoteTemplate } from '../../../types'

export function makeTemplates(): NoteTemplate[] {
  const d = new Date()
  const longDate      = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long',  year: 'numeric' })
  const shortDate     = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
  const shortDateYear = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  return [
    {
      id: 'blank',
      name: 'Blank',
      description: 'Start with an empty note',
      icon: <Icon name="file-text" size={18} />,
      title: '',
      content: '',
    },
    {
      id: 'meeting',
      name: 'Meeting Notes',
      description: 'Attendees, agenda, decisions, actions',
      icon: <Icon name="users" size={18} />,
      title: 'Meeting — ',
      content: `## Date & Attendees
**Date:** ${longDate}
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
      icon: <Icon name="bar-chart-2" size={18} />,
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
      icon: <Icon name="lightbulb" size={18} />,
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
      icon: <Icon name="book-open" size={18} />,
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
      icon: <Icon name="check-square" size={18} />,
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
      icon: <Icon name="zap" size={18} />,
      title: `Standup ${shortDate}`,
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
      icon: <Icon name="flask-conical" size={18} />,
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
      icon: <Icon name="graduation-cap" size={18} />,
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
      icon: <Icon name="bug" size={18} />,
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
      icon: <Icon name="globe" size={18} />,
      title: `Week of ${shortDateYear}`,
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
}
