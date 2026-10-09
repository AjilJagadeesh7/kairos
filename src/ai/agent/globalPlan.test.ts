import { describe, expect, it } from 'vitest'
import { globalPlanFromCalls, noteContent, noteTag } from './globalPlan'
import { applyGlobalPlan, revertGlobalPlan, withLink } from './globalApply'
import { cardListing } from './globalContext'
import { agentContext } from './agentContext'
import { newAgentState } from './agentTools'
import { NOW } from './__fixtures__/board'
import { testVault } from './__fixtures__/vault'
import { memoryWriter } from './__fixtures__/globalEnv'
import type { AllowedIds, Board, ToolCall } from '../../types'

const call = (name: string, args: Record<string, unknown>): ToolCall => ({ id: `c-${name}`, name, args })
const everything = (v = testVault()): AllowedIds => ({
  cards: new Set(v.boards.flatMap((b) => b.tasks.map((t) => t.id))),
  notes: new Set(v.notes.map((n) => n.id)),
})

describe('globalPlanFromCalls', () => {
  it('resolves card actions on whichever board has the card, naming the board', () => {
    const v = testVault()
    const plan = globalPlanFromCalls([
      call('move_card', { cardId: 'HOME-1', toColumn: 'done' }),
      call('create_card', { board: 'sprint board', column: 'todo', title: 'Fix Safari login', sourceNoteId: 'Standup notes' }),
      call('update_card', { cardId: 'KAI-4', priority: 'high' }),
    ], v, everything(v))!
    expect(plan.map((a) => a.summary)).toEqual([
      'Move HOME-1 "Renew car insurance" → Done (Home)',
      'Add "Fix Safari login" to Sprint board › To Do',
      'Update KAI-4 "Write release notes": priority (Sprint board)',
    ])
    expect(plan[0].resolved).toMatchObject({ kind: 'card', boardId: 'b2', action: { tool: 'move_card', toColumnId: 'h-done' } })
    expect(plan[1].resolved).toMatchObject({ kind: 'card', boardId: 'b1', action: { tool: 'create_card', columnId: 'c-todo', linkedNotes: ['n-standup'] } })
    expect(plan[1].changes.map((c) => c.field)).toEqual(['board', 'source note', 'column', 'title'])
  })

  it('refuses cards and notes the model was not shown in this request', () => {
    const v = testVault()
    const allowed: AllowedIds = { cards: new Set(['t-KAI-1']), notes: new Set(['n-go']) }
    const plan = globalPlanFromCalls([
      call('move_card', { cardId: 'HOME-1', toColumn: 'Done' }),
      call('move_card', { cardId: 'KAI-1', toColumn: 'Done' }),
      call('link_notes', { fromNoteId: 'n-go', toNoteId: 'Lisbon trip' }),
    ], v, allowed)!
    expect(plan[0]).toMatchObject({ resolved: null, unresolved: expect.stringMatching(/wasn't among the cards/) })
    expect(plan[1].resolved).not.toBeNull()
    expect(plan[2]).toMatchObject({ resolved: null, unresolved: expect.stringMatching(/"Lisbon trip" wasn't among the notes/) })
  })

  it('asks for the board when two boards use the same key', () => {
    const v = testVault()
    const twin: Board = { ...v.boards[1], id: 'b3', title: 'Side project', tasks: v.boards[1].tasks.map((t) => ({ ...t, id: `x-${t.id}` })) }
    v.boards.push(twin)
    const allowed = everything(v)
    const [ambiguous, named] = globalPlanFromCalls([
      call('move_card', { cardId: 'HOME-1', toColumn: 'Done' }),
      call('move_card', { cardId: 'HOME-1', board: 'Side project', toColumn: 'Done' }),
    ], v, allowed)!
    expect(ambiguous.unresolved).toMatch(/matches cards on Home and Side project — name the board/)
    expect(named.resolved).toMatchObject({ boardId: 'b3' })
  })

  it('validates new notes: title, folder, tags as #words, no duplicate titles', () => {
    const v = { ...testVault(), folders: ['Projects/Work'] }
    const plan = globalPlanFromCalls([
      call('create_note', { title: 'Planning 2026-10-09', body: '## Plan\n- [ ] KAI-4', tags: ['Planning', '#weekly review', 'x'], folder: 'projects/work' }),
      call('create_note', { title: 'Go backend design', body: 'dup' }),
      call('create_note', { title: 'Elsewhere', body: 'x', folder: 'Nope' }),
      call('create_note', { title: 'planning 2026-10-09', body: 'same title again' }),
    ], v, everything(v))!
    expect(plan[0].resolved).toEqual({ kind: 'create_note', title: 'Planning 2026-10-09', body: '## Plan\n- [ ] KAI-4\n\n#planning #weekly-review', folder: 'Projects/Work' })
    expect(plan[1].unresolved).toMatch(/already exists/)
    expect(plan[2].unresolved).toMatch(/No folder named "Nope"/)
    expect(plan[3].unresolved).toMatch(/already exists/)
  })

  it('links to and from a note the same plan creates, and skips links that exist', () => {
    const v = testVault()
    v.notes[0] = { ...v.notes[0], content: `${v.notes[0].content}\n\n[[Lisbon trip]]` }
    const plan = globalPlanFromCalls([
      call('link_notes', { fromNoteId: 'n-standup', toNoteId: 'Changelog' }),
      call('create_note', { title: 'Changelog', body: 'v2 shipped' }),
      call('link_notes', { fromNoteId: 'Changelog', toNoteId: 'n-go' }),
      call('link_notes', { fromNoteId: 'n-go', toNoteId: 'n-trip' }),
      call('link_notes', { fromNoteId: 'n-go', toNoteId: 'Go backend design' }),
    ], v, everything(v))!
    expect(plan[0].resolved).toEqual({ kind: 'link_notes', from: { id: 'n-standup' }, toTitle: 'Changelog' })
    expect(plan[2].resolved).toEqual({ kind: 'link_notes', from: { newTitle: 'Changelog' }, toTitle: 'Go backend design' })
    expect(plan[3].unresolved).toBe('Already linked')
    expect(plan[4].unresolved).toMatch(/itself/)
  })

  it('refuses plans over 20 actions, unknown tools, and a second change to one card', () => {
    const v = testVault()
    expect(globalPlanFromCalls(Array.from({ length: 21 }, () => call('move_card', { cardId: 'KAI-1', toColumn: 'Done' })), v, everything(v))).toBeNull()
    const plan = globalPlanFromCalls([
      call('delete_card', { cardId: 'KAI-1' }),
      call('move_card', { cardId: 'KAI-1', toColumn: 'Done' }),
      call('move_card', { cardId: 'KAI-1', toColumn: 'Blocked' }),
    ], v, everything(v))!
    expect(plan[0].unresolved).toMatch(/can't be used here/)
    expect(plan[1].resolved).not.toBeNull()
    expect(plan[2].unresolved).toMatch(/already changes this card/)
  })

  it('normalizes tags and appends only the missing ones', () => {
    expect(noteTag('#Weekly Review')).toBe('weekly-review')
    expect(noteTag('a')).toBeNull()
    expect(noteContent('Body with #planning', ['planning', 'q4'])).toBe('Body with #planning\n\n#q4')
  })
})

describe('change context', () => {
  it('the agent overview lists boards, every card when they fit, and recent notes — all allowed', () => {
    const v = testVault()
    const s = newAgentState()
    const text = agentContext(v, 'move the api cards to done', 4000, s)
    expect(text).toContain('- KAI-2 "API rate limiting" [Sprint board › In Progress]')
    expect(text).toContain('- "Home" — columns: Todo | Done (done column)')
    expect(text).toMatch(/Recently edited notes[\s\S]*"Go backend design" \(id=n-go/)
    expect(s.allowed.cards.size).toBe(11)
    expect(s.allowed.notes.has('n-go')).toBe(true)
  })

  it('puts the matching cards first when the board doesn\'t fit', () => {
    const v = testVault()
    const listed = cardListing(v.boards, 'renew insurance', 60)
    expect(listed.text).toContain('HOME-1')
    expect(listed.omitted).toBeGreaterThan(0)
    expect(listed.text).toMatch(/more cards? not listed/)
  })
})

describe('applyGlobalPlan / revertGlobalPlan', () => {
  it('creates notes, links and card changes as one batch, and Undo reverts all of it', async () => {
    const v = testVault()
    const before = JSON.stringify(v)
    const actions = globalPlanFromCalls([
      call('create_note', { title: 'Changelog', body: 'Shipped KAI-7' }),
      call('link_notes', { fromNoteId: 'n-standup', toNoteId: 'Changelog' }),
      call('move_card', { cardId: 'KAI-4', toColumn: 'Done' }),
      call('move_card', { cardId: 'HOME-1', toColumn: 'Done' }),
    ], v, everything(v))!
    const { writer, log } = memoryWriter(v)
    const result = await applyGlobalPlan(actions, writer, NOW)
    expect(result.applied).toBe(4)
    expect(log).toEqual(['create Changelog', 'content n-standup', 'board b1', 'board b2'])
    expect(v.notes.find((n) => n.id === 'n-standup')!.content).toMatch(/\n\n\[\[Changelog\]\]$/)
    expect(result.touched).toEqual(['"Changelog"', '"Standup notes"', 'Sprint board', 'Home'])

    const { kept } = await revertGlobalPlan(result.undo, writer, NOW)
    expect(kept).toEqual([])
    const after = JSON.parse(JSON.stringify(v))
    const original = JSON.parse(before)
    // Undo restores content and columns; only the boards' updatedAt stamps differ.
    expect(after.notes).toEqual(original.notes)
    expect(after.boards.map((b: Board) => b.tasks.map((t) => t.columnId))).toEqual(original.boards.map((b: Board) => b.tasks.map((t) => t.columnId)))
  })

  it('Undo leaves a created note or a link the user edited since', async () => {
    const v = testVault()
    const actions = globalPlanFromCalls([
      call('create_note', { title: 'Plan', body: 'draft' }),
      call('link_notes', { fromNoteId: 'n-go', toNoteId: 'n-trip' }),
    ], v, everything(v))!
    const { writer } = memoryWriter(v)
    const result = await applyGlobalPlan(actions, writer, NOW)
    v.notes = v.notes.map((n) => (n.title === 'Plan' ? { ...n, content: 'draft, edited' } : n.id === 'n-go' ? { ...n, content: `${n.content}\nmore` } : n))
    const { kept } = await revertGlobalPlan(result.undo, writer, NOW)
    expect(kept).toEqual(['the link in "Go backend design"', '"Plan"'])
    expect(v.notes.some((n) => n.title === 'Plan')).toBe(true)
  })

  it('skips actions the vault no longer allows at Apply time', async () => {
    const v = testVault()
    const actions = globalPlanFromCalls([call('create_note', { title: 'Plan', body: 'x' })], v, everything(v))!
    v.notes.push({ ...v.notes[0], id: 'other', title: 'Plan' })
    const { writer } = memoryWriter(v)
    const result = await applyGlobalPlan(actions, writer, NOW)
    expect(result.applied).toBe(0)
    expect(Object.values(result.skipped)).toEqual(['A note with this title exists now'])
  })

  it('appends links the way appendWikilink does', () => {
    expect(withLink('Body\n\n', 'X')).toBe('Body\n\n[[X]]')
    expect(withLink('', 'X')).toBe('[[X]]')
  })
})
