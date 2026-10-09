import { useState } from 'react'
import { monthKey, useAiStore } from '../../../store/useAiStore'
import { SectionCard } from '../../molecules/SectionCard'
import { Field } from '../../molecules/Field'

const fmt = (n: number) => n.toLocaleString()

/** Settings → AI → Token usage: this month's count (from providers' usage fields) and an optional warning threshold. */
export function AiUsageCard() {
  const usage = useAiStore((s) => s.usage)
  const limit = useAiStore((s) => s.monthlyTokenLimit)
  const setLimit = useAiStore((s) => s.setMonthlyTokenLimit)
  const [draft, setDraft] = useState(limit ? String(limit) : '')

  const current = usage?.month === monthKey() ? usage : null
  const total = current ? current.promptTokens + current.completionTokens : 0
  const over = !!limit && total > limit

  function commit(v: string) {
    setDraft(v)
    const n = parseInt(v.replace(/[^\d]/g, ''), 10)
    setLimit(Number.isFinite(n) && n > 0 ? n : null)
  }

  return (
    <SectionCard title="Token usage">
      <div className="space-y-3">
        <p className={`text-sm ${over ? 'text-amber-600' : 'text-text'}`}>
          {current
            ? `${fmt(total)} tokens this month — ${fmt(current.promptTokens)} prompt, ${fmt(current.completionTokens)} reply, ${fmt(current.requests)} requests`
            : 'No tokens used this month.'}
          {over && ` · over your ${fmt(limit!)} threshold`}
        </p>
        <p className="text-[11px] text-text3">Counted from what each provider reports, on this device only. Providers that don't report usage aren't counted.</p>
        <Field label="Warn me above (tokens per month, blank = off)" placeholder="e.g. 2000000" value={draft} onChange={commit} type="text" />
      </div>
    </SectionCard>
  )
}
