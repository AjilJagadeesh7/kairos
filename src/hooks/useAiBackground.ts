import { useEffect } from 'react'
import { useAiStore } from '../store/useAiStore'
import { useAppStore } from '../store/useAppStore'
import { useJournalStore } from '../store/useJournalStore'
import type { JournalEntry, Note } from '../types'

const HOUR_MS = 3_600_000
const REINDEX_DEBOUNCE_MS = 5_000

function stamps(notes: Note[], journal: Record<string, JournalEntry>): Map<string, string> {
  const m = new Map<string, string>()
  for (const n of notes) m.set(`note:${n.id}`, n.updatedAt)
  for (const j of Object.values(journal)) m.set(`journal:${j.date}`, j.updatedAt)
  return m
}

/**
 * AI housekeeping while the AI toggle is on:
 *  - chat retention: swept at startup and hourly (there is no server cron);
 *  - semantic index: notes saved since it was built are re-embedded, debounced,
 *    and only while the app is in the foreground (PRD).
 * With the toggle off this does nothing and loads no AI code.
 */
export function useAiBackground(): void {
  const enabled = useAiStore((s) => s.enabled)
  const retention = useAiStore((s) => s.chatRetention)
  const indexed = useAiStore((s) => s.enabled && s.indexSource === 'on-device' && !!s.indexMeta)

  useEffect(() => {
    if (!enabled || retention === 'keep') return
    const sweep = () => void import('../ai/history/chatStore')
      .then(({ sweepChats }) => sweepChats(retention))
      .catch((err) => console.warn('[ai] chat retention sweep failed:', err))
    sweep()
    const timer = setInterval(sweep, HOUR_MS)
    return () => clearInterval(timer)
  }, [enabled, retention])

  useEffect(() => {
    if (!indexed) return
    let last = stamps(useAppStore.getState().notes, useJournalStore.getState().entries)
    const changed = new Set<string>()
    let timer: ReturnType<typeof setTimeout> | null = null

    const flush = () => {
      timer = null
      if (document.visibilityState !== 'visible') return // picked up when the app is back in front
      const keys = new Set(changed)
      changed.clear()
      if (keys.size) void import('../store/useAiIndexStore').then(({ useAiIndexStore }) => useAiIndexStore.getState().update(keys))
    }
    const onChange = () => {
      const now = stamps(useAppStore.getState().notes, useJournalStore.getState().entries)
      for (const [k, v] of now) if (last.get(k) !== v) changed.add(k)
      for (const k of last.keys()) if (!now.has(k)) changed.add(k)
      last = now
      if (changed.size) {
        if (timer) clearTimeout(timer)
        timer = setTimeout(flush, REINDEX_DEBOUNCE_MS)
      }
    }
    const onVisible = () => { if (document.visibilityState === 'visible' && changed.size && !timer) flush() }

    const unsubNotes = useAppStore.subscribe((s, p) => { if (s.notes !== p.notes) onChange() })
    const unsubJournal = useJournalStore.subscribe((s, p) => { if (s.entries !== p.entries) onChange() })
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      unsubNotes()
      unsubJournal()
      document.removeEventListener('visibilitychange', onVisible)
      if (timer) clearTimeout(timer)
    }
  }, [indexed])
}
