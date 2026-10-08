import type { BoardFacts, FactCard, FactList } from '../../../../types'

const count = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

interface Props {
  facts: BoardFacts
  /** Opens a card by its key. */
  onOpenCard: (key: string) => void
}

function CardRow({ card, onOpen }: { card: FactCard; onOpen: () => void }) {
  const detail = [card.column, card.due ? `due ${card.due}` : '', card.why ?? ''].filter(Boolean).join(' · ')
  return (
    <li>
      <button type="button" onClick={onOpen} className="flex w-full items-baseline gap-1.5 rounded px-1 py-0.5 text-left hover:bg-surface2">
        <span className="shrink-0 font-mono text-[10px] text-text3">{card.key}</span>
        <span className="min-w-0 flex-1 truncate text-[12px] text-text">{card.title}</span>
        <span className="shrink-0 text-[10px] text-text3">{detail}</span>
      </button>
    </li>
  )
}

function Section({ title, list, tone, onOpenCard }: { title: string; list: FactList; tone?: string; onOpenCard: (key: string) => void }) {
  if (!list.count) return null
  const more = list.count - list.cards.length
  return (
    <div>
      <p className={`mb-0.5 text-[10px] font-semibold uppercase tracking-wider ${tone ?? 'text-text3'}`}>{title} · {list.count}</p>
      <ul>{list.cards.map((c) => <CardRow key={c.key} card={c} onOpen={() => onOpenCard(c.key)} />)}</ul>
      {more > 0 && <p className="px-1 text-[10px] text-text3">+{more} more</p>}
    </div>
  )
}

/** The board's numbers exactly as code computed them — the model never counts. */
export function BoardFactsView({ facts, onOpenCard }: Props) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border/70 bg-bg/60 p-2" aria-label="Board facts">
      <ul className="flex flex-wrap gap-1">
        {facts.columns.map((c) => (
          <li
            key={c.name}
            title={c.subIssues ? `${c.cards} cards + ${c.subIssues} sub-issues` : `${c.cards} cards`}
            className={`rounded-md border px-1.5 py-0.5 text-[11px] ${c.overWipLimit ? 'border-red-500/50 text-red-600 dark:text-red-400' : 'border-border text-text2'}`}
          >
            {c.name} <span className="font-semibold tabular-nums text-text">{c.cards}</span>
            {c.wipLimit ? <span className="text-text3">/{c.wipLimit}</span> : null}
            {c.isDone && <span className="text-text3"> ✓</span>}
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-text3">
        {count(facts.totalIssues, 'issue')}
        {facts.totalIssues > facts.topLevelCards && ` (${count(facts.topLevelCards, 'card')} + ${count(facts.totalIssues - facts.topLevelCards, 'sub-issue')})`}
        {' '}· {facts.openIssues} open · {facts.doneIssues} done
        {facts.highPriorityOpen ? ` · ${facts.highPriorityOpen} high/urgent open` : ''}
      </p>
      {facts.activeSprint && (
        <p className="text-[11px] text-text3">
          Sprint {facts.activeSprint.name}: {facts.activeSprint.done}/{facts.activeSprint.issues} done
          {facts.activeSprint.endDate ? ` · ends ${facts.activeSprint.endDate}` : ''}
        </p>
      )}
      <Section title="Overdue" list={facts.overdue} tone="text-red-600 dark:text-red-400" onOpenCard={onOpenCard} />
      <Section title="Blocked" list={facts.blocked} tone="text-amber-600 dark:text-amber-400" onOpenCard={onOpenCard} />
      <Section title="Due in the next 7 days" list={facts.dueSoon} onOpenCard={onOpenCard} />
    </div>
  )
}
