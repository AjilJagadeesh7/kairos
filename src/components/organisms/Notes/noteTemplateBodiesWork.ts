/**
 * Markdown bodies for the work-oriented note templates. Split from
 * noteTemplates.tsx (which owns the metadata and icons) to keep both files
 * under the 300-line limit.
 *
 * Conventions across every template:
 *  - `###` for sections, `####` for sub-sections — the note title is the H1.
 *  - Tables ship with one italic example row so the intended shape is obvious,
 *    followed by a blank row to type into.
 *  - Callout types must be ones calloutPlugin recognises: NOTE/INFO, TIP,
 *    IMPORTANT, WARNING, DANGER, EXAMPLE, QUOTE, ABSTRACT. Anything else
 *    silently renders as a plain blockquote.
 */

export interface TemplateDates {
  longDate: string
  shortDate: string
  shortDateYear: string
}

export function workBodies({ longDate }: TemplateDates): Record<string, string> {
  return {
    meeting: `> [!ABSTRACT] Meeting details
> **Date:** ${longDate}
> **Attendees:** —
> **Purpose:** —

### 🗓️ Agenda
| # | Topic | Owner | Time |
|---|-------|-------|------|
| 1 | _Status update_ | _—_ | _10 min_ |
| 2 |  |  |  |
| 3 |  |  |  |

### 💬 Discussion
#### _Topic 1_
-

#### _Topic 2_
-

### ✅ Decisions
| Decision | Rationale | Decided by |
|----------|-----------|------------|
| _Ship on Friday_ | _Last safe date before the release_ | _—_ |
|  |  |  |

### 📋 Action items
- [ ] **Owner** — _what needs doing_ — due _date_
- [ ]

### 🔁 Follow-up
- **Next meeting:**
- **Parked for later:**
`,

    oneonone: `> [!ABSTRACT] 1:1 details
> **With:** —
> **Date:** ${longDate}
> **Since last time:** —

### 🗣️ Their topics
-

### 📌 My topics
-

### 🎯 Goals check-in
| Goal | Status | Notes |
|------|--------|-------|
| _Ship the onboarding revamp_ | _On track_ | _—_ |
|  |  |  |

### 💬 Feedback
**Going well**
-

**Could be better**
-

### 📋 Action items
- [ ] **Me** —
- [ ] **Them** —

### 🌱 Growth & career
- **Working towards:**
- **Support needed:**
`,

    standup: `### ⏮️ Yesterday
- [x] _What actually shipped_
- [ ] _Carried over_

### ▶️ Today
- [ ] _Main focus_
- [ ]

### 🚧 Blockers
| Blocker | What I need | Who can help |
|---------|-------------|--------------|
| _Waiting on API credentials_ | _Access granted_ | _—_ |
|  |  |  |

### 🗒️ Notes
-
`,

    project: `> [!ABSTRACT] At a glance
> **Goal:** —
> **Owner:** —
> **Target date:** —
> **Status:** 🟢 On track

### 🎯 Milestones
| # | Milestone | Due | Status |
|---|-----------|-----|--------|
| 1 | _Kickoff & scope_ | _—_ | ✅ Done |
| 2 | _Build_ | _—_ | 🟡 In progress |
| 3 | _Launch_ | _—_ | ⬜ Not started |

### 🧩 Workstreams
#### _Workstream 1_
- [ ]
- [ ]

#### _Workstream 2_
- [ ]

### ⚠️ Risks
| Risk | Impact | Likelihood | Mitigation | Owner |
|------|--------|------------|------------|-------|
| _Scope creep_ | _High_ | _Medium_ | _Freeze scope after kickoff_ | _—_ |
|  |  |  |  |  |

### 👥 Stakeholders
| Name | Role | Needs from us |
|------|------|---------------|
| _—_ | _Sponsor_ | _Weekly summary_ |

### 🔗 Resources
-

### 🗒️ Notes
-
`,

    decision: `> [!IMPORTANT] Decision record
> **Status:** 🟡 Proposed
> **Date:** ${longDate}
> **Deciders:** —

### 🧭 Context
_What forces a decision now? What constraints are fixed?_

### 🔀 Options considered
| Option | Pros | Cons | Effort |
|--------|------|------|--------|
| _A — do nothing_ | _No work_ | _Problem persists_ | _None_ |
| _B — …_ |  |  |  |
| _C — …_ |  |  |  |

### ✅ Decision
_We chose **B**, because…_

### 📉 Consequences
**We gain**
-

**We accept**
-

### 🔁 Revisit
- **When:** _date, or the trigger that reopens this_
- **Signs this was wrong:**
`,

    bug: `> [!DANGER] Summary
> _One line: what breaks, and for whom._

### 🖥️ Environment
| Field | Value |
|-------|-------|
| Version | _—_ |
| OS / device | _—_ |
| Frequency | _Always / Sometimes / Once_ |
| Severity | _Blocker / Major / Minor_ |

### 🔢 Steps to reproduce
1.
2.
3.

### ✅ Expected
_What should have happened._

### ❌ Actual
_What happened instead._

### 📎 Evidence
- _Screenshot, log excerpt, or stack trace_

### 🔍 Root cause
-

### 🛠️ Fix
- [ ] _The change_
- [ ] Test covering the regression
- [ ] Verified on _—_

### 🔗 Related
-
`,
  }
}
