import { openExternal } from '../../../../utils/openExternal'
import type { ReaderBlock, ReaderSpan, PageMeta } from '../../../../utils/webReader'

/**
 * Renders the extracted block model. Every element is constructed from the
 * allowlist in webReader.ts — no `dangerouslySetInnerHTML` anywhere, so fetched
 * page content can never inject markup or script.
 */

function Spans({ spans }: { spans: ReaderSpan[] }): JSX.Element {
  return (
    <>
      {spans.map((span, i) => {
        let content: JSX.Element | string = span.text
        if (span.code)   content = <code className="rounded bg-[rgb(var(--surface-3))] px-1 py-0.5 font-mono text-[0.9em]">{content}</code>
        if (span.strong) content = <strong className="font-semibold text-[rgb(var(--text))]">{content}</strong>
        if (span.em)     content = <em className="italic">{content}</em>
        if (span.href) {
          const href = span.href
          return (
            <button
              key={i}
              type="button"
              onPointerDown={e => e.stopPropagation()}
              onClick={() => void openExternal(href)}
              title={href}
              className="nodrag nopan inline text-left text-[rgb(var(--accent))] underline underline-offset-2 hover:opacity-80"
            >
              {content}
            </button>
          )
        }
        return <span key={i}>{content}</span>
      })}
    </>
  )
}

function Block({ block }: { block: ReaderBlock }): JSX.Element | null {
  switch (block.kind) {
    case 'heading': {
      const size = block.level === 1 ? 'text-[15px]' : block.level === 2 ? 'text-[14px]' : 'text-[13px]'
      return <p className={`mb-1.5 mt-3 font-bold text-[rgb(var(--text))] ${size}`}>{block.text}</p>
    }
    case 'paragraph':
      return <p className="mb-2 text-[12px] leading-relaxed text-[rgb(var(--text-2))]"><Spans spans={block.spans} /></p>
    case 'list':
      return (
        <ul className={`mb-2 ml-4 space-y-1 text-[12px] leading-relaxed text-[rgb(var(--text-2))] ${block.ordered ? 'list-decimal' : 'list-disc'}`}>
          {block.items.map((item, i) => <li key={i}><Spans spans={item} /></li>)}
        </ul>
      )
    case 'quote':
      return (
        <blockquote className="mb-2 border-l-2 border-[rgb(var(--accent))] pl-3 text-[12px] italic leading-relaxed text-[rgb(var(--text-2))]">
          <Spans spans={block.spans} />
        </blockquote>
      )
    case 'code':
      return (
        <pre className="mb-2 overflow-x-auto rounded-lg bg-[rgb(var(--surface-2))] p-2.5 font-mono text-[11px] leading-relaxed text-[rgb(var(--text-2))]">
          {block.text}
        </pre>
      )
    case 'image':
      return (
        <img
          src={block.src}
          alt={block.alt}
          loading="lazy"
          referrerPolicy="no-referrer"
          className="mb-2 max-h-64 w-full rounded-lg object-contain"
        />
      )
  }
}

export function WebReaderView({ meta, blocks, url }: {
  meta: PageMeta
  blocks: ReaderBlock[]
  url: string
}): JSX.Element {
  return (
    <div className="nodrag nopan h-full overflow-y-auto bg-[rgb(var(--surface))] px-4 py-3">
      <header className="mb-3 border-b border-[rgb(var(--border))] pb-2">
        <p className="text-[14px] font-bold leading-snug text-[rgb(var(--text))]">{meta.title}</p>
        <button
          type="button"
          onPointerDown={e => e.stopPropagation()}
          onClick={() => void openExternal(url)}
          className="nodrag nopan mt-0.5 truncate text-[10px] text-[rgb(var(--text-3))] hover:text-[rgb(var(--accent))] hover:underline"
        >
          {meta.siteName ? `${meta.siteName} · ` : ''}{new URL(url).hostname}
        </button>
      </header>

      {blocks.map((block, i) => <Block key={i} block={block} />)}
    </div>
  )
}
