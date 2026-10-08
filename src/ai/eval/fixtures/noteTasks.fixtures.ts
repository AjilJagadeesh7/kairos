/**
 * Ten meeting notes for the "Turn this into tasks" eval (PRD: ≥ 80% of action
 * items extracted, no invented items). Each expected item is a list of word
 * groups; an extracted title + quote matches when every group has a hit.
 * Notes mix checklists, prose assignments, done items and non-tasks.
 */
export interface TaskNoteCase {
  name: string
  note: string
  /** Each inner array: alternatives for one required word. */
  expected: string[][][]
}

export const TASK_NOTES: TaskNoteCase[] = [
  {
    name: 'sprint review',
    note: `# Sprint 14 review — 12 Oct
Passkeys shipped to 100% of users. Android build size is down to 31 MB.
Sam owns the WebDAV conflict fix; target is Beta 3.
- [ ] Decide whether to drop iOS from the roadmap
- [ ] Priya to draft the release notes
- [x] Cut Beta 2`,
    expected: [[['webdav'], ['conflict', 'fix']], [['ios']], [['release notes']]],
  },
  {
    name: 'client call',
    note: `Call with Acme, Tuesday
They liked the prototype. Budget is approved for Q1.
Next steps: I will send the revised quote by Friday. Lena needs to set up a staging account for them.
They asked about SSO — Marco will check whether our plan supports SAML.`,
    expected: [[['quote']], [['staging']], [['sso', 'saml']]],
  },
  {
    name: 'design crit',
    note: `## Design crit
The onboarding flow is too long. Everyone agreed the colour palette works.
Action items:
1. Ana: cut onboarding from 5 steps to 3
2. Tom: write copy for the empty states
3. Re-test with 5 users next week`,
    expected: [[['onboarding']], [['empty state', 'copy']], [['test']]],
  },
  {
    name: 'incident retro',
    note: `Incident retro — DB outage 03 Oct
Root cause: a migration locked the orders table for 14 minutes.
Follow-ups:
- [ ] Add a lock timeout to all migrations (owner: Raj)
- [ ] Page on-call when checkout error rate > 2%
- [x] Restore the missing orders
We should also document the rollback procedure in the runbook.`,
    expected: [[['lock timeout', 'timeout']], [['page', 'alert', 'on-call']], [['rollback', 'runbook']]],
  },
  {
    name: 'one-on-one',
    note: `1:1 with Jordan
Jordan is happy on the team but wants more ownership.
Agreed: Jordan will lead the search revamp starting next sprint.
I need to talk to finance about the conference budget.
Nothing else this week.`,
    expected: [[['search']], [['finance', 'budget', 'conference']]],
  },
  {
    name: 'planning',
    note: `# Q4 planning
Goals: ship offline mode, cut cloud costs by 20%.
Owners:
- Offline mode spec — Mei, due 2026-10-20
- Cost audit of S3 buckets — Dan
Open question: do we hire a second designer? (no decision yet)`,
    expected: [[['offline']], [['cost', 'audit', 's3']]],
  },
  {
    name: 'standup',
    note: `Standup
Yesterday: finished the PDF export.
Today: fixing the flaky login test, then reviewing Kai's PR.
Blocked: waiting for API keys from the vendor — will ping them again.`,
    expected: [[['flaky', 'login test']], [['review', 'pr']], [['api key', 'vendor', 'ping']]],
  },
  {
    name: 'board meeting',
    note: `Board meeting notes
Revenue grew 12% quarter over quarter. The board approved the hiring plan.
The CFO will circulate the updated forecast before the next meeting.
Legal must review the new data processing agreement.`,
    expected: [[['forecast']], [['data processing', 'agreement', 'dpa', 'legal']]],
  },
  {
    name: 'household',
    note: `Family meeting
- [ ] Renew car insurance before 31 Oct
- [ ] Book dentist for the kids
- [x] Pay the electricity bill
Grandma visits on the 14th — someone should clean the guest room.`,
    expected: [[['insurance']], [['dentist']], [['guest room', 'clean']]],
  },
  {
    name: 'no tasks',
    note: `Reading notes: "Thinking, Fast and Slow"
System 1 is fast and intuitive; System 2 is slow and deliberate.
Anchoring affects estimates even when the anchor is random.
I found chapter 12 the most interesting.`,
    expected: [],
  },
]
