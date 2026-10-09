/**
 * `propose_changes` → a plan card. The proposed changes are validated by the
 * same code as before (globalPlanFromCalls: only items the model was shown,
 * columns and dates checked, max 20); nothing is written until the user
 * applies. If anything read for this request addresses an AI, the plan says
 * which and starts with nothing selected.
 */
import { looksLikeInjection } from '../text/injection'
import { globalPlanFromCalls } from './globalPlan'
import { MAX_PLAN_ACTIONS } from './boardPlan'
import { newMessage } from './bubbleEnv'
import type { AgentState } from './agentTools'
import type { BubbleMessage, ChatSourceRef, GlobalEnv, GlobalPlanAction, ToolCall, TokenUsage } from '../../types'

export function planIntro(actions: GlobalPlanAction[]): string {
  const ok = actions.filter((a) => a.resolved).length
  const bad = actions.length - ok
  const head = ok
    ? `${ok} change${ok === 1 ? '' : 's'} to review — nothing changes until you apply.`
    : 'Nothing here can be applied.'
  return bad ? `${head} ${bad} couldn't be matched to your vault.` : head
}

/** Chips for what the plan touches: the cards it changes and the notes it links or makes cards from. */
export function planSources(actions: GlobalPlanAction[], env: GlobalEnv): ChatSourceRef[] {
  const vault = env.vault()
  const out = new Map<string, ChatSourceRef>()
  for (const a of actions) {
    const r = a.resolved
    if (r?.kind === 'card' && r.action.tool !== 'create_card') {
      const board = vault.boards.find((b) => b.id === r.boardId)
      const t = board?.tasks.find((x) => x.id === (r.action as { taskId: string }).taskId)
      if (t) out.set(`card:${t.id}`, { kind: 'card', id: t.id, boardId: r.boardId, title: `${t.key} ${t.title}` })
    }
    const noteIds = r?.kind === 'card' ? r.action.tool === 'create_card' ? r.action.linkedNotes ?? [] : []
      : r?.kind === 'link_notes' && 'id' in r.from ? [r.from.id] : []
    for (const id of noteIds) {
      const n = vault.notes.find((x) => x.id === id)
      if (n) out.set(`note:${n.id}`, { kind: 'note', id: n.id, title: n.title })
    }
  }
  return [...out.values()]
}

/** Labels of what was read that addresses an AI ("ignore previous instructions", "SYSTEM:"…). */
export function suspects(s: AgentState): string[] {
  return [...new Set(s.untrusted.filter((u) => looksLikeInjection(u.text)).map((u) => u.label))]
}

/** The changes in one `propose_changes` call, as the tool calls the validator takes. */
export function changeCalls(call: ToolCall): ToolCall[] {
  const changes = Array.isArray(call.args.changes) ? call.args.changes as Array<Record<string, unknown>> : []
  return changes.map((c, i) => ({ id: `${call.id}_${i}`, name: String(c.action ?? ''), args: c }))
}

/** The chat message for a proposal: the model's words, then the plan card. Null when too large. */
export function planMessage(call: ToolCall, env: GlobalEnv, s: AgentState, usage: TokenUsage | null): BubbleMessage | string {
  const calls = changeCalls(call)
  const actions = globalPlanFromCalls(calls, env.vault(), s.allowed)
  if (actions === null) return `That would be ${calls.length} changes — more than ${MAX_PLAN_ACTIONS} at once. Narrow it down, e.g. one board or one tag at a time.`
  if (!actions.length) return 'No changes were proposed.'
  const flagged = suspects(s)
  const warning = flagged.length
    ? `Some of what was read for this plan contains instructions aimed at an AI (${flagged.slice(0, 3).join(', ')}${flagged.length > 3 ? '…' : ''}). They weren't followed on purpose, but check each change and tick the ones you asked for.`
    : undefined
  const said = typeof call.args.summary === 'string' ? call.args.summary.trim() : ''
  return newMessage({
    role: 'assistant',
    action: 'global_plan',
    content: [said, planIntro(actions)].filter(Boolean).join('\n\n'),
    meta: s.steps.length ? s.steps.join(' · ') : undefined,
    usage: usage ?? undefined,
    sources: planSources(actions, env),
    globalPlan: { actions, selected: warning ? [] : actions.filter((a) => a.resolved).map((a) => a.id), state: 'pending', warning },
  })
}
