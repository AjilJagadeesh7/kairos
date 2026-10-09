/**
 * The note bubble, instruction-driven: the user says anything about the
 * note; the model picks what to do — answer in the chat, edit the selection
 * or the whole note, insert text, summarize, suggest a title or tags, or
 * extract tasks. The choice is made from the instruction alone (never the
 * note); the instruction itself drives the edit. Every change is previewed.
 */
import { decideMessages, NOTE_TOOLS } from '../prompts/noteAgent.v1'
import { notice } from './bubbleEnv'
import { runEdit, runInsert } from './noteEdit'
import { runExtractTasks } from './noteTasks'
import { runQuestion, runSuggestTags, runSuggestTitle, runSummarize } from './noteActions'
import type { BubbleEnv, GenOpts, ToolDef } from '../../types'

const DECIDE: GenOpts = { maxTokens: 200, temperature: 0, thinking: false }

/** Edits target the selection when there is one, else the whole note. */
export async function editNote(env: BubbleEnv, instruction: string, target: 'selection' | 'note' = 'selection'): Promise<void> {
  const selection = target === 'selection' ? env.bridge.selection() : null
  const doc = selection ?? env.bridge.document()
  if (!doc) { notice(env, 'The note is empty — write something first, or ask me to draft it.'); return }
  await runEdit(env, instruction, doc)
}

export async function runNoteInstruction(env: BubbleEnv, instruction: string): Promise<void> {
  const hasSelection = env.bridge.selection() !== null
  const tools: ToolDef[] = Object.values(NOTE_TOOLS)
  const [call] = await env.provider.callTools(decideMessages(instruction, hasSelection), tools, DECIDE)
  if (env.isStopped()) return
  switch (call?.name) {
    case 'edit_text': return editNote(env, instruction, call.args.target === 'note' || !hasSelection ? 'note' : 'selection')
    case 'insert_text': return runInsert(env, instruction, (['cursor', 'top', 'end'] as const).find((a) => a === call.args.at) ?? 'cursor')
    case 'summarize': return runSummarize(env)
    case 'suggest_title': return runSuggestTitle(env)
    case 'suggest_tags': return runSuggestTags(env)
    case 'extract_tasks': return runExtractTasks(env)
    default: return runQuestion(env, instruction)
  }
}
