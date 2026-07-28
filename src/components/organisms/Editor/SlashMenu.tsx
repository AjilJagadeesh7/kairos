import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '../../../icons/Icon'
import type { IconToken } from '../../../icons/tokens'
import type { EditorCommandHandlers } from './useEditorCommands'

interface MenuLeaf {
  id: string
  label: string
  icon: IconToken
  keywords: string
  action: () => void
}
interface MenuGroup {
  id: string
  label: string
  icon: IconToken
  children: MenuLeaf[]
}
type MenuNode = MenuLeaf | MenuGroup
const isGroup = (n: MenuNode): n is MenuGroup => 'children' in n

interface SlashMenuProps {
  x: number
  y: number
  query: string
  cmds: EditorCommandHandlers
  /** Deletes the "/query" text, then runs the given command. */
  onRun: (action: () => void) => void
  onDismiss: () => void
}

const CALLOUT_TYPES: Array<[string, string]> = [
  ['NOTE', 'Note'], ['TIP', 'Tip'], ['IMPORTANT', 'Important'], ['WARNING', 'Warning'], ['DANGER', 'Danger'],
]

const PANEL_W = 248

export function SlashMenu({ x, y, query, cmds, onRun, onDismiss }: SlashMenuProps) {
  const root = useMemo<MenuNode[]>(() => {
    const headings: MenuLeaf[] = [1, 2, 3].map(l => ({
      id: `h${l}`, label: `Heading ${l}`, icon: 'heading-1', keywords: `heading h${l} title`, action: () => cmds.onHeading(l),
    }))
    const callouts: MenuLeaf[] = CALLOUT_TYPES.map(([t, l]) => ({
      id: `co-${t}`, label: `${l} callout`, icon: 'info', keywords: `callout admonition ${l.toLowerCase()}`, action: () => cmds.onInsertCallout(t),
    }))
    const links: MenuLeaf[] = [
      { id: 'wikilink', label: 'Wikilink', icon: 'link-2', keywords: 'wikilink internal link note', action: cmds.onAddLink },
      { id: 'embed', label: 'Embed note', icon: 'brackets', keywords: 'embed transclusion include note', action: cmds.onAddTransclusion },
      { id: 'extlink', label: 'External link', icon: 'external-link', keywords: 'external url web link', action: cmds.onAddExternalLink },
    ]
    return [
      { id: 'text', label: 'Text', icon: 'type', keywords: 'text body paragraph', action: cmds.onTurnIntoText },
      { id: 'heading', label: 'Heading', icon: 'heading-1', children: headings },
      { id: 'bullet', label: 'Bullet list', icon: 'list', keywords: 'bullet unordered list', action: cmds.onBulletList },
      { id: 'numbered', label: 'Numbered list', icon: 'list-ordered', keywords: 'numbered ordered list', action: cmds.onOrderedList },
      { id: 'task', label: 'Task list', icon: 'list-checks', keywords: 'task todo checklist checkbox', action: cmds.onTaskList },
      { id: 'quote', label: 'Quote', icon: 'quote', keywords: 'quote blockquote', action: cmds.onBlockquote },
      { id: 'callout', label: 'Callout', icon: 'info', children: callouts },
      { id: 'table', label: 'Table', icon: 'plus', keywords: 'table grid', action: cmds.onInsertTable },
      { id: 'code', label: 'Code block', icon: 'code-2', keywords: 'code block snippet', action: cmds.onInsertCodeBlock },
      { id: 'chart', label: 'Chart', icon: 'bar-chart-2', keywords: 'chart graph diagram', action: cmds.onInsertChart },
      { id: 'link', label: 'Link / embed', icon: 'link-2', children: links },
    ]
  }, [cmds])

  const allLeaves = useMemo<MenuLeaf[]>(() => {
    const out: MenuLeaf[] = []
    for (const n of root) { if (isGroup(n)) out.push(...n.children); else out.push(n) }
    return out
  }, [root])

  const [submenu, setSubmenu] = useState<MenuGroup | null>(null)
  const [activeIdx, setActiveIdx] = useState(0)

  const q = query.trim().toLowerCase()
  const searching = q.length > 0

  const list: MenuNode[] = useMemo(() => {
    if (searching) return allLeaves.filter(l => l.label.toLowerCase().includes(q) || l.keywords.includes(q))
    return submenu ? submenu.children : root
  }, [searching, q, allLeaves, submenu, root])

  // Reset the highlight when the visible list changes — React's "adjust state
  // during render" pattern (avoids a setState-in-effect).
  const listKey = `${q}|${submenu?.id ?? ''}`
  const [prevKey, setPrevKey] = useState(listKey)
  if (prevKey !== listKey) {
    setPrevKey(listKey)
    setActiveIdx(0)
  }

  // Keep the keyboard-highlighted row scrolled into view.
  const activeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => { activeRef.current?.scrollIntoView({ block: 'nearest' }) }, [activeIdx, submenu, q])

  function choose(node: MenuNode | undefined) {
    if (!node) return
    if (isGroup(node)) { setSubmenu(node); setActiveIdx(0) }
    else onRun(node.action)
  }

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onDismiss(); return }
      if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx(i => Math.min(i + 1, list.length - 1)); return }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setActiveIdx(i => Math.max(i - 1, 0)); return }
      if (e.key === 'ArrowLeft') {
        if (!searching && submenu) { e.preventDefault(); setSubmenu(null); setActiveIdx(0) }
        return
      }
      if (e.key === 'ArrowRight' || e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        choose(list[activeIdx])
      }
    }
    window.addEventListener('keydown', onKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list, activeIdx, submenu, searching, onDismiss])

  const containerRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    // pointerdown covers mouse + touch + pen. composedPath() is captured at
    // dispatch time, so it still reports "inside" even when opening a submenu
    // re-renders and detaches the clicked button before this handler runs.
    const onDown = (e: Event) => {
      const c = containerRef.current
      if (c && !e.composedPath().includes(c)) onDismiss()
    }
    window.addEventListener('pointerdown', onDown)
    return () => window.removeEventListener('pointerdown', onDown)
  }, [onDismiss])

  const clampedX = Math.min(Math.max(x, 8), window.innerWidth - PANEL_W - 8)
  const clampedY = Math.min(y, window.innerHeight - 340)

  const heading = searching ? `Results for "${query}"` : submenu ? submenu.label : 'Insert block'

  return createPortal(
    <div
      ref={containerRef}
      role="listbox"
      aria-label="Slash command menu"
      style={{ left: clampedX, top: clampedY, width: PANEL_W }}
      className="fixed z-[9999] overflow-hidden rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] shadow-2xl"
    >
      <div className="flex items-center gap-1.5 border-b border-[rgb(var(--border))] px-3 py-1.5">
        {!searching && submenu ? (
          <button type="button" onMouseDown={e => e.preventDefault()} onClick={() => { setSubmenu(null); setActiveIdx(0) }}
            className="flex items-center text-[rgb(var(--text-3))] hover:text-[rgb(var(--text))]">
            <Icon name="chevron-right" size={12} className="rotate-180" />
          </button>
        ) : (
          <Icon name="type" size={11} className="text-[rgb(var(--accent))]" />
        )}
        <span className="min-w-0 flex-1 truncate text-[10px] font-semibold uppercase tracking-wide text-[rgb(var(--text-3))]">
          {heading}
        </span>
      </div>

      {list.length === 0 ? (
        <div className="px-3 py-3 text-xs text-[rgb(var(--text-3))]">No blocks match “{query}”</div>
      ) : (
        <ul role="presentation" className="max-h-72 overflow-y-auto py-1">
          {list.map((node, i) => (
            <li key={node.id} role="option" aria-selected={i === activeIdx}>
              <button
                ref={i === activeIdx ? activeRef : null}
                type="button"
                // onMouseDown keeps editor focus/selection; onClick fires for
                // mouse, touch tap and pen (and not while touch-scrolling).
                onMouseDown={e => e.preventDefault()}
                onClick={() => choose(node)}
                onMouseEnter={() => setActiveIdx(i)}
                className={`flex w-full items-center gap-2.5 px-3 py-1.5 text-left transition ${
                  i === activeIdx ? 'bg-[rgb(var(--accent)/0.1)] text-[rgb(var(--text))]' : 'text-[rgb(var(--text-2))]'
                }`}
              >
                <Icon name={node.icon} size={14} className="shrink-0 text-[rgb(var(--accent))]" />
                <span className="min-w-0 flex-1 truncate text-[13px]">{node.label}</span>
                {isGroup(node) && <Icon name="chevron-right" size={12} className="shrink-0 text-[rgb(var(--text-3))]" />}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="border-t border-[rgb(var(--border))] px-3 py-1.5">
        <span className="text-[10px] text-[rgb(var(--text-3))]">↑↓ move · → open · ← back · ↵ select · esc</span>
      </div>
    </div>,
    document.body,
  )
}
