import { useNavigate } from 'react-router-dom'
import type { FactCard, FactList, NoteRef, VaultFacts } from '../../../../types'

const count = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-md border border-border/70 px-2 py-1">
      <p className={`text-[15px] font-semibold tabular-nums ${tone ?? 'text-text'}`}>{value}</p>
      <p className="text-[10px] text-text3">{label}</p>
    </div>
  )
}

function Cards({ title, list }: { title: string; list: FactList }) {
  const navigate = useNavigate()
  if (!list.count) return null
  const more = list.count - list.cards.length
  const open = (c: FactCard) => navigate(c.boardId && c.id ? `/kanban/${c.boardId}/${c.id}` : '/kanban')
  return (
    <div>
      <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-text3">{title} · {list.count}</p>
      <ul>
        {list.cards.map((c) => (
          <li key={`${c.boardId}:${c.key}`}>
            <button type="button" onClick={() => open(c)} className="flex w-full items-baseline gap-1.5 rounded px-1 py-0.5 text-left hover:bg-surface2">
              <span className="shrink-0 font-mono text-[10px] text-text3">{c.key}</span>
              <span className="min-w-0 flex-1 truncate text-[12px] text-text">{c.title}</span>
              <span className="shrink-0 text-[10px] text-text3">{[c.board, c.column, c.due ? `due ${c.due}` : ''].filter(Boolean).join(' · ')}</span>
            </button>
          </li>
        ))}
      </ul>
      {more > 0 && <p className="px-1 text-[10px] text-text3">+{more} more</p>}
    </div>
  )
}

function Notes({ title, count: n, notes, detail }: { title: string; count: number; notes: NoteRef[]; detail?: (n: NoteRef) => string }) {
  const navigate = useNavigate()
  if (!n) return null
  return (
    <div>
      <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wider text-text3">{title} · {n}</p>
      <ul>
        {notes.map((x) => (
          <li key={`${x.kind}:${x.id}`}>
            <button type="button" onClick={() => navigate(x.kind === 'journal' ? `/journal/${x.id}` : `/notes/${x.id}`)} className="flex w-full items-baseline gap-1.5 rounded px-1 py-0.5 text-left hover:bg-surface2">
              <span className="min-w-0 flex-1 truncate text-[12px] text-text">{x.title}</span>
              {detail && <span className="shrink-0 text-[10px] text-text3">{detail(x)}</span>}
            </button>
          </li>
        ))}
      </ul>
      {n > notes.length && <p className="px-1 text-[10px] text-text3">+{n - notes.length} more</p>}
    </div>
  )
}

/** Pending items or a review, exactly as code computed them — the model never counts. */
export function VaultFactsView({ facts }: { facts: VaultFacts }) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border/70 bg-bg/60 p-2" aria-label="Vault facts">
      {facts.kind === 'pending' ? (
        <>
          <div className="grid grid-cols-3 gap-1.5">
            <Stat label="overdue" value={facts.overdue.count} tone={facts.overdue.count ? 'text-red-600 dark:text-red-400' : undefined} />
            <Stat label={`due by ${facts.weekEnd.slice(5)}`} value={facts.dueThisWeek.count} />
            <Stat label="open checklist items" value={facts.notesWithOpenItems.openItems} />
          </div>
          <p className="text-[11px] text-text3">{count(facts.openCards, 'open card')} across all boards</p>
          <Cards title="Overdue" list={facts.overdue} />
          <Cards title="Due this week" list={facts.dueThisWeek} />
          <Notes
            title="Notes with open items" count={facts.notesWithOpenItems.count} notes={facts.notesWithOpenItems.notes}
            detail={(n) => { const o = facts.notesWithOpenItems.notes.find((x) => x.id === n.id); return o ? count(o.open, 'item') : '' }}
          />
        </>
      ) : (
        <>
          <p className="text-[11px] text-text3">{facts.since === facts.today ? `Today, ${facts.today}` : `${facts.since} → ${facts.today}`}</p>
          <div className="grid grid-cols-4 gap-1.5">
            <Stat label="notes created" value={facts.notesCreated.count} />
            <Stat label="notes edited" value={facts.notesEdited.count} />
            <Stat label="cards done" value={facts.cardsCompleted.count} />
            <Stat label="overdue now" value={facts.overdueNow} tone={facts.overdueNow ? 'text-red-600 dark:text-red-400' : undefined} />
          </div>
          <Notes title="Created" count={facts.notesCreated.count} notes={facts.notesCreated.notes} />
          <Notes title="Edited" count={facts.notesEdited.count} notes={facts.notesEdited.notes} />
          <Notes title="Journal" count={facts.journalEntries.count} notes={facts.journalEntries.notes} />
          <Cards title="Completed" list={facts.cardsCompleted} />
          <Cards title="Moved" list={facts.cardsMoved} />
          <Cards title="Created cards" list={facts.cardsCreated} />
        </>
      )}
    </div>
  )
}
