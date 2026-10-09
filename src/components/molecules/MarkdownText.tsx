import { Fragment, useMemo, type ReactNode } from 'react'
import { parseMarkdown, type Inline } from '../../utils/miniMarkdown'
import { openExternal } from '../../utils/openExternal'

function inline(nodes: Inline[], key = ''): ReactNode[] {
  return nodes.map((n, i) => {
    const k = `${key}${i}`
    switch (n.t) {
      case 'text': return <Fragment key={k}>{n.v}</Fragment>
      case 'strong': return <strong key={k} className="font-semibold">{inline(n.c, `${k}.`)}</strong>
      case 'em': return <em key={k}>{inline(n.c, `${k}.`)}</em>
      case 'code': return <code key={k} className="rounded bg-surface2 px-1 py-px font-mono text-[12px]">{n.v}</code>
      case 'check': return <span key={k} aria-label={n.done ? 'done' : 'to do'} className="mr-1 font-mono text-text3">{n.done ? '☑' : '☐'}</span>
      case 'cite': return <sup key={k} className="mx-px rounded bg-surface2 px-1 font-mono text-[10px] text-text3">{n.n}</sup>
      case 'link': return (
        <a key={k} href={n.href} onClick={(e) => { e.preventDefault(); void openExternal(n.href) }} className="text-accent underline-offset-2 hover:underline">
          {inline(n.c, `${k}.`)}
        </a>
      )
    }
  })
}

/**
 * Renders an AI reply's markdown as React elements (no HTML injection). Used
 * by the chat and bubbles; `[n]` citations show as small badges.
 */
export function MarkdownText({ text, className = '' }: { text: string; className?: string }) {
  const blocks = useMemo(() => parseMarkdown(text), [text])
  return (
    <div className={`space-y-2 break-words text-[13px] leading-relaxed text-text ${className}`}>
      {blocks.map((b, i) => {
        switch (b.t) {
          case 'p': return <p key={i} className="whitespace-pre-wrap">{inline(b.c)}</p>
          case 'h': return <p key={i} className={`font-semibold ${b.level <= 2 ? 'text-[14px]' : 'text-[13px]'}`}>{inline(b.c)}</p>
          case 'pre': return <pre key={i} className="overflow-x-auto rounded-lg bg-surface2 p-2 font-mono text-[12px]">{b.v}</pre>
          case 'ul': return <ul key={i} className="list-disc space-y-0.5 pl-5">{b.items.map((it, j) => <li key={j}>{inline(it)}</li>)}</ul>
          case 'ol': return <ol key={i} start={b.start} className="list-decimal space-y-0.5 pl-5">{b.items.map((it, j) => <li key={j}>{inline(it)}</li>)}</ol>
        }
      })}
    </div>
  )
}
