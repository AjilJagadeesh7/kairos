import { useMemo } from 'react'
import { wordDiff } from '../../../../ai/text/wordDiff'

/** Word-level diff: removed text struck in red, added text highlighted green. */
export function DiffView({ before, after }: { before: string; after: string }) {
  const ops = useMemo(() => wordDiff(before, after), [before, after])
  return (
    <p className="whitespace-pre-wrap break-words text-[13px] leading-relaxed text-text">
      {ops.map((op, i) => {
        if (op.type === 'same') return <span key={i}>{op.text}</span>
        if (op.type === 'del') {
          return <del key={i} className="rounded-sm bg-red-500/10 text-red-600 decoration-red-500/70 dark:text-red-400">{op.text}</del>
        }
        return <ins key={i} className="rounded-sm bg-emerald-500/15 text-emerald-700 no-underline dark:text-emerald-300">{op.text}</ins>
      })}
    </p>
  )
}
