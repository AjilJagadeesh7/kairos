import { describe, expect, it } from 'vitest'
import { checklistTasks, isGrounded, mergeTasks, normalizeForMatch, runExtractTasks } from './noteTasks'
import { resolveTaskTarget, taskActions } from './taskPlanActions'
import { applyPlan } from './boardApply'
import { fakeBridge, fakeEnv, fakeProvider } from './__fixtures__/fakes'
import { NOW, sprintBoard } from './__fixtures__/board'
import type { TaskPlan } from '../../types'

const NOTE = `# Sprint 14 review

Passkeys shipped. Priya will draft the release notes by tomorrow.
Marco should look into the kanban lag before Beta 3.

## Open
- [ ] Decide whether to drop iOS from the roadmap
- [x] Cut Beta 2
- [ ] Book the venue for the offsite on 2026-11-02`

const words = (s: string) => new Set(normalizeForMatch(s).split(' '))

describe('checklistTasks', () => {
  it('takes unchecked lines only, with a single date as the due date', () => {
    const tasks = checklistTasks(NOTE, NOW)
    expect(tasks.map((t) => t.title)).toEqual([
      'Decide whether to drop iOS from the roadmap',
      'Book the venue for the offsite on 2026-11-02',
    ])
    expect(tasks[1].due).toBe('2026-11-02T00:00:00.000Z')
    expect(tasks.every((t) => t.origin === 'checklist')).toBe(true)
  })
  it('resolves relative dates in a line in code', () => {
    expect(checklistTasks('- [ ] Send invoice tomorrow', NOW)[0].due).toBe('2026-10-09T00:00:00.000Z')
  })
})

describe('isGrounded', () => {
  const n = normalizeForMatch(NOTE)
  it('accepts quotes from the note, ignoring markdown and punctuation', () => {
    expect(isGrounded('Priya will draft the release notes by tomorrow.', n, words(NOTE))).toBe(true)
    expect(isGrounded('**Marco** should look into the kanban lag', n, words(NOTE))).toBe(true)
  })
  it('rejects text that is not in the note', () => {
    expect(isGrounded('Sam will migrate the database to Postgres', n, words(NOTE))).toBe(false)
    expect(isGrounded('', n, words(NOTE))).toBe(false)
  })
})

describe('mergeTasks', () => {
  it('keeps grounded items, flags invented and done ones, and folds duplicates of checklist lines', () => {
    const tasks = mergeTasks(NOTE, checklistTasks(NOTE, NOW), [
      { title: 'Priya: draft release notes', quote: 'Priya will draft the release notes by tomorrow (2026-10-09).', due: '2026-10-09' },
      { title: 'Marco: investigate kanban lag', quote: 'Marco should look into the kanban lag before Beta 3.' },
      { title: 'Migrate to Postgres', quote: 'Sam will migrate the database to Postgres.' },
      { title: 'Cut Beta 2', quote: 'Cut Beta 2' },
      { title: 'Decide on iOS', quote: 'Decide whether to drop iOS from the roadmap', priority: 'high' },
    ], NOTE)
    const by = (title: string) => tasks.find((t) => t.title === title)
    expect(tasks).toHaveLength(6)
    expect(by('Priya: draft release notes')).toMatchObject({ origin: 'model', due: '2026-10-09T00:00:00.000Z' })
    expect(by('Priya: draft release notes')?.unresolved).toBeUndefined()
    expect(by('Migrate to Postgres')?.unresolved).toBe('Not found in the note')
    expect(by('Cut Beta 2')?.unresolved).toBe('Already done in the note')
    // The iOS checklist line absorbed the model's duplicate (and its priority).
    expect(by('Decide whether to drop iOS from the roadmap')).toMatchObject({ origin: 'checklist', priority: 'high' })
    expect(by('Decide on iOS')).toBeUndefined()
  })
})

describe('runExtractTasks', () => {
  it('proposes a task plan with usable items preselected; relative dates reach the model resolved', async () => {
    const { provider, calls } = fakeProvider({
      json: () => ({ tasks: [{ title: 'Draft release notes', quote: 'Priya will draft the release notes by tomorrow' }, { title: 'Invent', quote: 'nothing like this' }] }),
    })
    const { env, messages } = fakeEnv(provider, { id: 'n1', title: 'Sprint 14 review', content: NOTE })
    await runExtractTasks(env)
    const plan = messages[0].taskPlan!
    expect(plan.tasks.map((t) => t.title)).toEqual([
      'Decide whether to drop iOS from the roadmap', 'Book the venue for the offsite on 2026-11-02', 'Draft release notes', 'Invent',
    ])
    expect(plan.selected).toHaveLength(3)
    expect(plan).toMatchObject({ noteId: 'n1', state: 'pending', boardId: null })
    expect(calls[0].opts.thinking).toBe(true)
    expect(calls[0].messages.at(-1)!.content).toMatch(/by tomorrow \(\d{4}-\d{2}-\d{2}\)/)
  })

  it('reads only the selection when there is one', async () => {
    const { provider, calls } = fakeProvider({ json: () => ({ tasks: [] }) })
    const { env, messages } = fakeEnv(provider, { content: NOTE }, { bridge: fakeBridge({ markdown: 'Marco should look into the kanban lag.' }).bridge })
    await runExtractTasks(env)
    expect(calls[0].messages.at(-1)!.content).not.toContain('Priya')
    expect(messages[0]).toMatchObject({ role: 'notice', content: 'No action items found in the selection.' })
  })

  it('reads a long note in parts, never cutting it', async () => {
    const long = Array.from({ length: 12 }, (_, i) => `## Topic ${i}\n${'Some discussion here. '.repeat(80)}\nAction: owner${i} to follow up on topic ${i}.`).join('\n\n')
    const { provider, calls } = fakeProvider({ json: () => ({ tasks: [] }) })
    const { env } = fakeEnv(provider, { content: long }, { budget: 2000 })
    await runExtractTasks(env)
    expect(calls.length).toBeGreaterThan(1)
    const sent = calls.map((c) => c.messages.at(-1)!.content).join('\n')
    for (let i = 0; i < 12; i++) expect(sent).toContain(`owner${i} to follow up`)
  })
})

describe('task plan → cards', () => {
  const plan = (over: Partial<TaskPlan> = {}): TaskPlan => ({
    noteId: 'n1', noteTitle: 'Sprint 14 review', selected: ['a', 'b'], boardId: null, columnId: null, state: 'pending',
    tasks: [
      { id: 'a', title: 'Draft release notes', quote: 'Priya will draft the release notes', origin: 'model', priority: null, due: '2026-10-09T00:00:00.000Z' },
      { id: 'b', title: 'Fix login bug', quote: '- [ ] Fix login bug', origin: 'checklist', priority: null },
    ],
    ...over,
  })

  it('defaults to the first non-done column of the remembered or first board', () => {
    const board = sprintBoard()
    expect(resolveTaskTarget(plan(), [board], null)?.column.title).toBe('To Do')
    expect(resolveTaskTarget(plan(), [board], { boardId: 'b1', columnId: 'c-doing' })?.column.title).toBe('In Progress')
    expect(resolveTaskTarget(plan({ boardId: 'b1', columnId: 'c-blocked' }), [board], null)?.column.title).toBe('Blocked')
  })

  it('creates cards linked to the note, and skips items already made from this note', () => {
    const board = sprintBoard()
    board.tasks[0] = { ...board.tasks[0], linkedNotes: ['n1'] } // KAI-1 "Fix login bug" came from n1 before
    const target = resolveTaskTarget(plan(), [board], null)!
    const actions = taskActions(plan(), target)
    expect(actions[1].unresolved).toBe('Already on Sprint board as KAI-1')
    const r = applyPlan(board, actions)
    expect(r.applied).toBe(1)
    const created = r.board.tasks.find((t) => t.title === 'Draft release notes')!
    expect(created).toMatchObject({ linkedNotes: ['n1'], columnId: 'c-todo', due: '2026-10-09T00:00:00.000Z' })
    expect(created.description).toBe('From the note: “Priya will draft the release notes”')
  })
})
