import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { useJournalStore, todayDate } from '../../../store/useJournalStore'
import { useConfirmStore } from '../../../store/useConfirmStore'
import { SlotRenderer } from '../../molecules/SlotRenderer'
import { MarkdownEditor } from '../Editor/MarkdownEditor'
import { HistoryPanel } from '../Editor/HistoryPanel'
import { Icon } from '../../../icons/Icon'

type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved'

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function formatDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  const dow = new Date(y, m - 1, d).getDay()
  return `${DAY_NAMES[dow]}, ${MONTH_NAMES[m - 1]} ${d}, ${y}`
}

function offsetDate(date: string, days: number): string {
  const [y, m, d] = date.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() + days)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`
}

interface JournalEditorProps {
  date: string
}

export function JournalEditor({ date }: JournalEditorProps) {
  const entries    = useJournalStore(s => s.entries)
  const saveEntry  = useJournalStore(s => s.saveEntry)
  const deleteEntry = useJournalStore(s => s.deleteEntry)
  const navigate   = useNavigate()

  const existing   = entries[date]
  const [content, setContent]       = useState(existing?.content ?? '')
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [showHistory, setShowHistory] = useState(false)
  const [restoreKey, setRestoreKey]   = useState(0)

  const contentRef  = useRef(content)
  const prevDateRef = useRef(date)
  useEffect(() => { contentRef.current = content }, [content])

  // Reset when date changes
  useEffect(() => {
    if (prevDateRef.current === date) return
    prevDateRef.current = date
    setContent(entries[date]?.content ?? '')
    setSaveStatus('idle')
    setShowHistory(false)
  }, [date, entries])

  const handleRestore = (restoredContent: string) => {
    setContent(restoredContent)
    setRestoreKey(k => k + 1)
    setSaveStatus('dirty')
    setShowHistory(false)
  }

  const persist = useCallback(async () => {
    setSaveStatus('saving')
    await saveEntry(date, contentRef.current)
    setSaveStatus('saved')
    setTimeout(() => setSaveStatus(s => s === 'saved' ? 'idle' : s), 2000)
  }, [date, saveEntry])

  // Auto-save on change
  useEffect(() => {
    if (content === (entries[date]?.content ?? '')) return
    setSaveStatus('dirty')
    const handle = window.setTimeout(() => void persist(), 2000)
    return () => window.clearTimeout(handle)
  }, [content]) // eslint-disable-line react-hooks/exhaustive-deps

  // Ctrl+S shortcut
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        if (saveStatus === 'dirty') void persist()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [saveStatus, persist])

  const handleDelete = () => {
    void useConfirmStore.getState()
      .confirm({
        title: `Delete entry for ${formatDate(date)}?`,
        message: 'This cannot be undone.',
        confirmLabel: 'Delete',
        danger: true,
      })
      .then(ok => { if (ok) { deleteEntry(date); navigate('/journal') } })
  }

  const today    = todayDate()
  const isToday  = date === today
  const prevDate = offsetDate(date, -1)
  const nextDate = offsetDate(date, 1)

  return (
    <section className="relative flex h-full flex-col bg-[rgb(var(--bg))]">
      <div className="flex h-full flex-col p-4">
        {/* Toolbar */}
        <div className="mb-3 flex items-center gap-2">
          <button
            onClick={() => navigate(`/journal/${prevDate}`)}
            className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--surface))] text-[rgb(var(--text-2))] transition hover:border-[rgb(var(--accent)/0.5)] hover:text-[rgb(var(--accent))]"
            title="Previous day"
          >
            <Icon name="chevron-left" size={14} />
          </button>

          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-bold text-[rgb(var(--text))]">{formatDate(date)}</h2>
            {isToday && (
              <span className="text-[11px] font-medium text-[rgb(var(--accent))]">Today</span>
            )}
          </div>

          <button
            onClick={() => navigate(`/journal/${nextDate}`)}
            disabled={nextDate > today}
            className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--surface))] text-[rgb(var(--text-2))] transition hover:border-[rgb(var(--accent)/0.5)] hover:text-[rgb(var(--accent))] disabled:cursor-not-allowed disabled:opacity-30"
            title="Next day"
          >
            <Icon name="chevron-right" size={14} />
          </button>
          <SlotRenderer slot="journal:header:end" props={{ date }} className="flex items-center" />

          <span className={`hidden shrink-0 items-center gap-1 text-xs transition-all sm:inline-flex ${
            saveStatus === 'idle' ? 'pointer-events-none opacity-0' : 'opacity-100'
          } ${saveStatus === 'saved' ? 'text-green-500' : 'text-[rgb(var(--text-3))]'}`}>
            {saveStatus === 'saving' && 'Saving…'}
            {saveStatus === 'saved'  && <><Icon name="check" size={11} /> Saved</>}
            {saveStatus === 'dirty'  && 'Unsaved'}
          </span>

          <button
            type="button"
            onClick={() => void persist()}
            disabled={saveStatus === 'saving' || saveStatus === 'idle'}
            title={saveStatus === 'dirty' ? 'Save now (⌘S)' : 'No unsaved changes'}
            className={`flex h-[34px] shrink-0 items-center gap-1.5 rounded-md border px-3 text-sm font-medium transition ${
              saveStatus === 'dirty'
                ? 'border-[rgb(var(--accent)/0.4)] bg-[rgb(var(--accent)/0.1)] text-[rgb(var(--accent))] hover:bg-[rgb(var(--accent)/0.2)]'
                : 'cursor-default border-[rgb(var(--border))] bg-[rgb(var(--surface))] text-[rgb(var(--text-3))] opacity-40'
            }`}
          >
            <Icon name="save" size={14} />
            <span className="hidden sm:inline">Save</span>
          </button>

          <button
            type="button"
            title="Version history"
            onClick={() => setShowHistory(h => !h)}
            className={`flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-md border transition ${
              showHistory
                ? 'border-[rgb(var(--accent)/0.4)] bg-[rgb(var(--accent)/0.1)] text-[rgb(var(--accent))]'
                : 'border-[rgb(var(--border))] bg-[rgb(var(--surface))] text-[rgb(var(--text-2))] hover:border-[rgb(var(--accent)/0.5)] hover:text-[rgb(var(--accent))]'
            }`}
          >
            <Icon name="history" size={14} />
          </button>

          {existing && (
            <button
              type="button"
              title="Delete this entry"
              onClick={handleDelete}
              className="flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--surface))] text-[rgb(var(--text-3))] transition hover:border-red-400/50 hover:text-red-400"
            >
              <Icon name="trash-2" size={14} />
            </button>
          )}
        </div>

        {/* Editor */}
        <div className="min-h-0 flex-1 rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--surface))]">
          <MarkdownEditor
            key={restoreKey}
            noteId={date}
            initialMarkdown={content}
            noteTitle={formatDate(date)}
            onChange={setContent}
          />
        </div>
      </div>

      {showHistory && (
        <HistoryPanel
          id={date}
          type="journal"
          onRestore={handleRestore}
          onClose={() => setShowHistory(false)}
        />
      )}
    </section>
  )
}
