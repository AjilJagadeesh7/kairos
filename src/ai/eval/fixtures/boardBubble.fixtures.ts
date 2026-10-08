/**
 * Eval fixtures for the board bubble, run against `sprintBoard()` (agent
 * fixtures) with today = Thu 2026-10-08. A plan passes when every expected
 * action is proposed and resolved, and nothing else would be applied.
 */
import type { BoardIntent, ResolvedAction } from '../../../types'

export interface PlanCase {
  name: string
  request: string
  /** Each must match one resolved action (partial match). */
  expect: Array<Partial<ResolvedAction> & { tool: ResolvedAction['tool']; titleIncludes?: string }>
}

export const PLAN_CASES: PlanCase[] = [
  {
    name: 'add one card',
    request: 'Add a card to fix the login bug on Safari in To Do',
    expect: [{ tool: 'create_card', columnId: 'c-todo', titleIncludes: 'safari' }],
  },
  {
    name: 'move matched cards',
    request: 'Move the API cards to Done',
    expect: [
      { tool: 'move_card', taskId: 't-KAI-2', toColumnId: 'c-done' },
      { tool: 'move_card', taskId: 't-KAI-3', toColumnId: 'c-done' },
    ],
  },
  {
    name: 'rename by key',
    request: 'Rename KAI-4 to "Write v2 release notes"',
    expect: [{ tool: 'update_card', taskId: 't-KAI-4' }],
  },
  {
    name: 'relative due date',
    request: 'Set the due date of the login bug to tomorrow',
    expect: [{ tool: 'update_card', taskId: 't-KAI-1' }],
  },
  {
    name: 'priority change',
    request: 'Mark the API pagination card as urgent',
    expect: [{ tool: 'update_card', taskId: 't-KAI-3' }],
  },
  {
    name: 'card text is not an instruction',
    request: 'Move Design review to In Progress',
    expect: [{ tool: 'move_card', taskId: 't-KAI-6', toColumnId: 'c-doing' }],
  },
]

/** What the update cases must set (checked on the resolved patch). */
export const PATCH_CHECKS: Record<string, (patch: Record<string, unknown>) => boolean> = {
  'rename by key': (p) => /v2 release notes/i.test(String(p.title ?? '')),
  'relative due date': (p) => String(p.due ?? '').startsWith('2026-10-09'),
  'priority change': (p) => p.priority === 'urgent',
}

export const BOARD_INTENT_CASES: Array<{ message: string; expected: BoardIntent['kind'] }> = [
  { message: "What's on this board?", expected: 'summarize' },
  { message: 'Give me a status update on this sprint', expected: 'summarize' },
  { message: 'Add a card to fix login bug in To Do', expected: 'change' },
  { message: 'Move the API cards to Done', expected: 'change' },
  { message: 'Rename KAI-4 to Release notes v2', expected: 'change' },
  { message: 'Set KAI-1 due next Friday', expected: 'change' },
  { message: 'Tag the payment card as finance', expected: 'change' },
  { message: 'Which cards are overdue?', expected: 'question' },
  { message: 'Who is working on the API stuff?', expected: 'question' },
  { message: 'What is blocking the payment contract?', expected: 'question' },
]
