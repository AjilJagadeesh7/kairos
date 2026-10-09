/** A fake global-chat env over an in-memory vault, plus a writer for Apply/Undo tests. */
import { retrieve } from '../../index/retrieve'
import { NOW } from './board'
import { testVault } from './vault'
import type { VaultWriter } from '../globalApply'
import type { BubbleMessage, Condensed, GlobalEnv, LLMProvider, Msg, VaultSnapshot, WebAccess } from '../../../types'

export function fakeGlobalEnv(provider: LLMProvider, opts: { vault?: VaultSnapshot; history?: Msg[]; budget?: number; web?: WebAccess | null } = {}) {
  const messages: BubbleMessage[] = []
  const progress: string[] = []
  const vault = opts.vault ?? testVault()
  const env: GlobalEnv = {
    provider,
    budget: opts.budget ?? 8000,
    sink: {
      add: (m) => { messages.push(m) },
      patch: (id, update) => { const i = messages.findIndex((m) => m.id === id); if (i !== -1) messages[i] = update(messages[i]) },
      progress: (t) => { if (t) progress.push(t) },
    },
    isStopped: () => false,
    history: () => opts.history ?? [],
    cache: new Map<string, Condensed>(),
    attachedContext: async () => null,
    vault: () => vault,
    now: () => NOW,
    retrieve: (q, f) => retrieve(q, f, { vault, indexed: null, embedQuery: null, modelId: null }),
    web: opts.web ?? null,
  }
  return { env, messages, progress, vault }
}

/** A VaultWriter over a mutable snapshot, recording what it did. */
export function memoryWriter(vault: VaultSnapshot) {
  const log: string[] = []
  let n = 0
  const writer: VaultWriter = {
    boards: () => vault.boards,
    commitBoard: (id, next) => { vault.boards = vault.boards.map((b) => (b.id === id ? next : b)); log.push(`board ${id}`) },
    notes: () => vault.notes,
    createNote: async ({ title, content, folder }) => {
      const id = `new-${++n}`
      const at = new Date().toISOString()
      vault.notes = [{ id, title, content, folder, tags: [], embedding: [], createdAt: at, updatedAt: at }, ...vault.notes]
      log.push(`create ${title}`)
      return id
    },
    setNoteContent: async (id, content) => {
      vault.notes = vault.notes.map((x) => (x.id === id ? { ...x, content } : x))
      log.push(`content ${id}`)
    },
    trashNote: async (id) => { vault.notes = vault.notes.filter((x) => x.id !== id); log.push(`trash ${id}`) },
  }
  return { writer, log }
}
