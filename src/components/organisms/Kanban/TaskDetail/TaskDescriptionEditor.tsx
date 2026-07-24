import { useEffect, useRef, useState } from 'react'
import { useKanbanStore } from '../../../../store/useKanbanStore'
import { Button } from '../../../atoms/Button'
import { markdownToHtml } from '../../../../utils/markdownToHtml'
import type { IconToken } from '../../../../icons/tokens'
import { Icon } from '../../../../icons/Icon'
import type { KanbanTask } from '../../../../types/kanban.types'

interface Props {
  boardId: string
  task: KanbanTask
}

// Rendered-markdown styling, scoped to this component (no notes/journal editor).
const PROSE =
  'text-sm leading-relaxed text-[rgb(var(--text))] ' +
  '[&_h1]:mb-1 [&_h1]:mt-2 [&_h1]:text-base [&_h1]:font-bold ' +
  '[&_h2]:mb-1 [&_h2]:mt-2 [&_h2]:text-[15px] [&_h2]:font-semibold ' +
  '[&_h3]:font-semibold [&_p]:my-1.5 ' +
  '[&_ul]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:my-0.5 ' +
  '[&_a]:text-[rgb(var(--accent))] [&_a]:underline ' +
  '[&_code]:rounded [&_code]:bg-[rgb(var(--surface-3))] [&_code]:px-1 [&_code]:py-0.5 [&_code]:text-[0.85em] ' +
  '[&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-[rgb(var(--surface-3))] [&_pre]:p-3 [&_pre_code]:bg-transparent [&_pre_code]:px-0 ' +
  '[&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-[rgb(var(--border))] [&_blockquote]:pl-3 [&_blockquote]:text-[rgb(var(--text-2))] ' +
  '[&_.task-item]:flex [&_.task-item]:items-baseline [&_.task-item]:gap-2'

interface Tool { icon: IconToken; title: string; run: () => void }

export function TaskDescriptionEditor({ boardId, task }: Props): JSX.Element {
  const updateTask = useKanbanStore(s => s.updateTask)
  const [editing, setEditing] = useState(false)
  const [tab, setTab] = useState<'write' | 'preview'>('write')
  const [value, setValue] = useState(task.description ?? '')
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => { setValue(task.description ?? '') }, [task.id, task.description])
  useEffect(() => { if (editing && tab === 'write') ref.current?.focus() }, [editing, tab])

  function commit() {
    updateTask(boardId, task.id, { description: value.trim() || undefined })
    setEditing(false)
    setTab('write')
  }
  function cancel() {
    setValue(task.description ?? '')
    setEditing(false)
    setTab('write')
  }

  /** Wraps the selection with markdown delimiters (bold, italic, code…). */
  function wrap(before: string, after = before) {
    const ta = ref.current
    if (!ta) return
    const { selectionStart: s, selectionEnd: e } = ta
    const next = value.slice(0, s) + before + value.slice(s, e) + after + value.slice(e)
    setValue(next)
    requestAnimationFrame(() => { ta.focus(); ta.selectionStart = s + before.length; ta.selectionEnd = e + before.length })
  }

  /** Prefixes each selected line (lists, headings, quote). */
  function linePrefix(prefix: string) {
    const ta = ref.current
    if (!ta) return
    const { selectionStart: s, selectionEnd: e } = ta
    const lineStart = value.lastIndexOf('\n', s - 1) + 1
    const block = value.slice(lineStart, e)
    const replaced = block.split('\n').map(l => prefix + l).join('\n')
    const next = value.slice(0, lineStart) + replaced + value.slice(e)
    setValue(next)
    requestAnimationFrame(() => { ta.focus(); ta.selectionStart = lineStart; ta.selectionEnd = lineStart + replaced.length })
  }

  function insertLink() {
    const ta = ref.current
    if (!ta) return
    const { selectionStart: s, selectionEnd: e } = ta
    const text = value.slice(s, e) || 'text'
    const link = `[${text}](url)`
    const next = value.slice(0, s) + link + value.slice(e)
    setValue(next)
    const urlStart = s + text.length + 3
    requestAnimationFrame(() => { ta.focus(); ta.selectionStart = urlStart; ta.selectionEnd = urlStart + 3 })
  }

  const tools: Array<Tool | 'divider'> = [
    { icon: 'bold', title: 'Bold', run: () => wrap('**') },
    { icon: 'italic', title: 'Italic', run: () => wrap('*') },
    { icon: 'strikethrough', title: 'Strikethrough', run: () => wrap('~~') },
    { icon: 'code-2', title: 'Code', run: () => wrap('`') },
    'divider',
    { icon: 'heading-1', title: 'Heading 1', run: () => linePrefix('# ') },
    { icon: 'heading-2', title: 'Heading 2', run: () => linePrefix('## ') },
    'divider',
    { icon: 'list', title: 'Bulleted list', run: () => linePrefix('- ') },
    { icon: 'list-ordered', title: 'Numbered list', run: () => linePrefix('1. ') },
    { icon: 'list-checks', title: 'Checklist', run: () => linePrefix('- [ ] ') },
    { icon: 'quote', title: 'Quote', run: () => linePrefix('> ') },
    { icon: 'link', title: 'Link', run: insertLink },
  ]

  return (
    <section className="mb-5">
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-[rgb(var(--text-3))]">Description</h3>

      {!editing ? (
        <div
          onClick={() => setEditing(true)}
          className="min-h-[64px] cursor-text rounded-lg border border-transparent p-2 transition hover:border-[rgb(var(--border))] hover:bg-[rgb(var(--surface-2))]"
        >
          {task.description
            ? <div className={PROSE} dangerouslySetInnerHTML={{ __html: markdownToHtml(task.description) }} />
            : <span className="text-sm text-[rgb(var(--text-3))]">Add a description…</span>}
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-[rgb(var(--accent))]/60 bg-[rgb(var(--surface))]">
          {/* Toolbar */}
          <div className="flex flex-wrap items-center gap-0.5 border-b border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] px-1.5 py-1">
            {tools.map((t, i) => t === 'divider'
              ? <span key={i} className="mx-1 h-4 w-px bg-[rgb(var(--border))]" />
              : (
                <button
                  key={t.icon}
                  type="button"
                  title={t.title}
                  disabled={tab === 'preview'}
                  onMouseDown={e => e.preventDefault()}
                  onClick={t.run}
                  className="flex h-7 w-7 items-center justify-center rounded text-[rgb(var(--text-2))] transition hover:bg-[rgb(var(--surface-3))] hover:text-[rgb(var(--text))] disabled:opacity-30"
                >
                  <Icon name={t.icon} size={15} />
                </button>
              ))}
            <div className="ml-auto flex items-center gap-0.5 rounded-md bg-[rgb(var(--surface-3))] p-0.5">
              {(['write', 'preview'] as const).map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setTab(m)}
                  className={`rounded px-2 py-0.5 text-[11px] font-medium capitalize transition ${tab === m ? 'bg-[rgb(var(--surface))] text-[rgb(var(--text))] shadow-sm' : 'text-[rgb(var(--text-3))]'}`}
                >
                  {m}
                </button>
              ))}
            </div>
          </div>

          {tab === 'write' ? (
            <textarea
              ref={ref}
              value={value}
              onChange={e => setValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Escape') { e.preventDefault(); cancel() }
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); commit() }
              }}
              placeholder="Add a description… Markdown supported"
              className="block max-h-[420px] min-h-[140px] w-full resize-y bg-transparent p-3 font-mono text-[13px] leading-relaxed text-[rgb(var(--text))] outline-none placeholder:text-[rgb(var(--text-3))]"
            />
          ) : (
            <div className={`min-h-[140px] p-3 ${PROSE}`}>
              {value.trim()
                ? <div dangerouslySetInnerHTML={{ __html: markdownToHtml(value) }} />
                : <span className="text-sm text-[rgb(var(--text-3))]">Nothing to preview.</span>}
            </div>
          )}

          <div className="flex items-center gap-2 border-t border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] p-2">
            <Button variant="submit" size="sm" onClick={commit}>Save</Button>
            <Button variant="hollow" size="sm" onClick={cancel}>Cancel</Button>
            <span className="ml-auto text-[10px] text-[rgb(var(--text-3))]">⌘↵ to save · Markdown supported</span>
          </div>
        </div>
      )}
    </section>
  )
}
