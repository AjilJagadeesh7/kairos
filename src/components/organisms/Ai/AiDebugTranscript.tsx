import { useEffect, useRef } from 'react'
import { Button } from '../../atoms/Button'
import { Icon } from '../../../icons/Icon'
import { JSON_CHECK_RUNS, type JsonCheckResult } from '../../../ai/debug/jsonCheck'
import type { AiDebugTurn } from '../../../types'

interface AiDebugTranscriptProps {
  turns: AiDebugTurn[]
  check: JsonCheckResult | null
  busy: boolean
  onSwitchProvider: () => void
}

/** Raw transcript: output is shown exactly as streamed, no markdown rendering. */
export function AiDebugTranscript({ turns, check, busy, onSwitchProvider }: AiDebugTranscriptProps) {
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => { end.current?.scrollIntoView({ block: 'end' }) }, [turns, check])

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-3">
      {turns.map((t) => (
        <div key={t.id} className={t.role === 'user' ? 'self-end max-w-[85%]' : 'max-w-full'}>
          {t.role === 'error' ? (
            <div className="space-y-2 rounded-lg border border-red-500/30 bg-red-500/5 px-3 py-2 text-xs text-red-600 dark:text-red-400">
              <p className="flex items-start gap-1.5"><Icon name="alert-triangle" size={12} className="mt-0.5 shrink-0" />{t.content}</p>
              <Button variant="hollow" size="xs" onClick={onSwitchProvider}>Switch provider</Button>
            </div>
          ) : (
            <div className={`whitespace-pre-wrap break-words rounded-lg px-3 py-2 font-mono text-xs ${
              t.role === 'user' ? 'bg-accent/10 text-text' : 'border border-border bg-surface2 text-text'
            }`}>
              {t.content || (busy ? '…' : '(empty response)')}
            </div>
          )}
          {t.usage && (
            <p className="mt-1 text-[10px] text-text3">
              {t.usage.promptTokens} prompt + {t.usage.completionTokens} completion tokens
            </p>
          )}
        </div>
      ))}

      {check && (
        <div className="rounded-lg border border-border bg-surface2 px-3 py-2 text-xs text-text">
          <p className="font-medium">
            JSON check: {check.passed}/{JSON_CHECK_RUNS} schema-valid
            {check.failed > 0 && <span className="text-red-500"> · {check.failed} failed</span>}
            {busy && <span className="text-text3"> · running…</span>}
          </p>
          {check.errors.slice(-3).map((e, i) => <p key={i} className="mt-1 text-[11px] text-red-500">{e}</p>)}
        </div>
      )}
      <div ref={end} />
    </div>
  )
}
