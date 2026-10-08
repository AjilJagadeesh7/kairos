/**
 * Markdown bodies for the work-oriented note templates. Split from
 * noteTemplates.tsx (which owns the metadata and icons) to keep both files
 * under the 300-line limit.
 *
 * Conventions across every template (keep them calm and minimal):
 *  - `###` for sections, `####` for sub-sections — the note title is the H1.
 *  - No emoji and no coloured callouts. Section names say what goes in them;
 *    an italic hint underneath says how to fill it in.
 *  - Key details are a plain bullet list, not a callout.
 *  - Tables ship with one italic example row so the intended shape is obvious,
 *    followed by a blank row to type into.
 *  - Status values are words (Not started / In progress / Done).
 */

export interface TemplateDates {
  longDate: string
  shortDate: string
  shortDateYear: string
}

export function workBodies({ longDate }: TemplateDates): Record<string, string> {
  return {
    meeting: `- **Date:** ${longDate}
- **Attendees:**
- **Purpose:**

### Agenda
| Topic | Owner | Time |
|-------|-------|------|
| _Status update_ | _—_ | _10 min_ |
|  |  |  |

### Notes
-

### Decisions
-

### Action items
- [ ] _Owner — what needs doing, by when_
- [ ]
`,

    oneonone: `- **With:**
- **Date:** ${longDate}

### Topics
_Theirs first, then mine._
-

### Progress
| Goal | Status | Notes |
|------|--------|-------|
| _Ship the onboarding revamp_ | _On track_ | _—_ |
|  |  |  |

### Feedback
-

### Action items
- [ ] _Me —_
- [ ] _Them —_
`,

    standup: `### Yesterday
-

### Today
-

### Blockers
_Leave empty if none._
-
`,

    project: `- **Goal:**
- **Owner:**
- **Target date:**
- **Status:** In progress

### Milestones
| Milestone | Due | Status |
|-----------|-----|--------|
| _Kickoff and scope_ | _—_ | _Done_ |
| _Build_ | _—_ | _In progress_ |
| _Launch_ | _—_ | _Not started_ |

### Tasks
- [ ]
- [ ]

### Risks
| Risk | Impact | Mitigation |
|------|--------|------------|
| _Scope creep_ | _High_ | _Freeze scope after kickoff_ |
|  |  |  |

### Notes
-
`,

    decision: `- **Status:** Proposed
- **Date:** ${longDate}
- **Deciders:**

### Context
_What forces a decision now? What constraints are fixed?_

### Options
| Option | Pros | Cons |
|--------|------|------|
| _A — do nothing_ | _No work_ | _Problem persists_ |
| _B_ |  |  |

### Decision
_We chose B, because…_

### Consequences
-
`,

    bug: `### Summary
_One line: what breaks, and for whom._

### Environment
- **Version:**
- **OS / device:**
- **Severity:**

### Steps to reproduce
1.
2.
3.

### Expected
_What should have happened._

### Actual
_What happened instead._

### Fix
- [ ] _The change_
- [ ] A test covering the regression
`,
  }
}
