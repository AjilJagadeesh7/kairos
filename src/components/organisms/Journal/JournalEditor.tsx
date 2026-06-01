import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { useJournalStore, todayDate } from '../../../store/useJournalStore'
import { useConfirmStore } from '../../../store/useConfirmStore'
import { SlotRenderer } from '../../molecules/SlotRenderer'
import { MarkdownEditor } from '../Editor/MarkdownEditor'
import { HistoryPanel } from '../Editor/HistoryPanel'
import { JournalRightSidebar } from './JournalRightSidebar'
import { JournalReadingMode } from './JournalReadingMode'
import { JournalExportMenu } from './JournalExportMenu'
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
  const entries        = useJournalStore(s => s.entries)
  const saveEntry      = useJournalStore(s => s.saveEntry)
  const setEntryNoSync = useJournalStore(s => s.setEntryNoSync)
  const deleteEntry    = useJournalStore(s => s.deleteEntry)
  const navigate       = useNavigate()

  const existing   = entries[date]
  const [content, setContent]         = useState(existing?.content ?? '')
  const [saveStatus, setSaveStatus]   = useState<SaveStatus>('idle')
  const [showHistory, setShowHistory] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [readingMode, setReadingMode] = useState(false)
  const [restoreKey, setRestoreKey]   = useState(0)
  const [shownDate, setShownDate]     = useState(date)
  const [pendingFlush, setPendingFlush] = useState<{ date: string; content: string } | null>(null)

  const contentRef    = useRef(content)
  const saveTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const editorRootRef = useRef<HTMLDivElement>(null)
  useEffect(() => { contentRef.current = content }, [content])

  // Reset editor content *during render* when the date changes — not in an
  // effect. The editor is keyed by `date`, so it remounts and captures `content`
  // as its defaultValue on mount. Resetting in a post-commit effect would let
  // the new editor mount with the PREVIOUS date's content (stale text stays
  // visible and gets auto-saved into the new date's file). `content` here still
  // holds the leaving date's text, so queue it for the flush effect below.
  if (shownDate !== date) {
    setPendingFlush({ date: shownDate, content })
    setShownDate(date)
    setContent(entries[date]?.content ?? '')
    setSaveStatus('idle')
    setShowHistory(false)
  }

  // Flush the unsaved content of the date we just left. `pendingFlush` is a
  // fresh object per date switch, so this runs exactly once per switch.
  useEffect(() => {
    if (!pendingFlush) return

    // Cancel any pending auto-save so it can't write old content to new date
    if (saveTimerRef.current) { clearTimeout(saveTimerRef.current); saveTimerRef.current = null }

    const storedContent = useJournalStore.getState().entries[pendingFlush.date]?.content ?? ''
    if (pendingFlush.content !== storedContent) void saveEntry(pendingFlush.date, pendingFlush.content)
  }, [pendingFlush, saveEntry])

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
    saveTimerRef.current = window.setTimeout(() => void persist(), 2000)
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current) }
  }, [content]) // eslint-disable-line react-hooks/exhaustive-deps

  // Ctrl+S to save, Esc to leave reading mode
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && readingMode) { setReadingMode(false); return }
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        if (saveStatus === 'dirty') void persist()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [saveStatus, persist, readingMode])

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
  const label    = formatDate(date)
  const prevDate = offsetDate(date, -1)
  const nextDate = offsetDate(date, 1)

  return (
    <section className="relative flex h-full flex-col bg-bg">
      {/* ── Toolbar (mirrors EditorToolbar) ─────────────────────────────── */}
      <div className="flex h-10 shrink-0 items-center gap-1.5 border-b border-border px-3">
        <button
          type="button"
          title="Previous day"
          onClick={() => navigate(`/journal/${prevDate}`)}
          className="flex h-7 w-7 items-center justify-center rounded text-text3 transition hover:bg-surface3 hover:text-text"
        >
          <Icon name="chevron-left" size={14} />
        </button>

        <div className="min-w-0">
          <span className="truncate text-sm font-semibold text-text">{label}</span>
          {isToday && <span className="ml-2 text-[11px] font-medium text-accent">Today</span>}
        </div>

        <button
          type="button"
          title="Next day"
          onClick={() => navigate(`/journal/${nextDate}`)}
          className="flex h-7 w-7 items-center justify-center rounded text-text3 transition hover:bg-surface3 hover:text-text"
        >
          <Icon name="chevron-right" size={14} />
        </button>

        <SlotRenderer slot="journal:header:end" props={{ date }} className="flex items-center" />

        {/* Save status */}
        <span className={`mr-1 shrink-0 text-xs transition-all ${
          saveStatus === 'idle' ? 'opacity-0 pointer-events-none' : 'opacity-100'
        } ${saveStatus === 'saved' ? 'text-green-500' : 'text-text3'}`}>
          {saveStatus === 'saving' && 'Saving…'}
          {saveStatus === 'saved'  && <span className="flex items-center gap-0.5"><Icon name="check" size={11} /> Saved</span>}
          {saveStatus === 'dirty'  && 'Unsaved'}
        </span>

        <div className="flex-1" />

        {/* Save */}
        <button
          type="button"
          onClick={() => void persist()}
          disabled={saveStatus === 'saving' || saveStatus === 'idle'}
          title={saveStatus === 'dirty' ? 'Save (⌘S)' : 'No unsaved changes'}
          className={`flex h-7 items-center gap-1 rounded px-2.5 text-xs font-medium transition ${
            saveStatus === 'dirty'
              ? 'bg-accent/10 text-accent hover:bg-accent/20'
              : 'cursor-default text-text3 opacity-40'
          }`}
        >
          <Icon name="save" size={12} />
          Save
        </button>

        {/* Export */}
        <JournalExportMenu title={label} markdown={content} editorRootRef={editorRootRef} />

        <div className="mx-0.5 h-4 w-px bg-border" />

        {/* Reading mode */}
        <button type="button" title="Reading mode" onClick={() => setReadingMode(v => !v)}
          className={`flex h-7 w-7 items-center justify-center rounded transition ${
            readingMode ? 'bg-accent/10 text-accent' : 'text-text3 hover:bg-surface3 hover:text-text'
          }`}
        >
          <Icon name="eye" size={14} />
        </button>

        {/* History */}
        <button type="button" title="Version history" onClick={() => setShowHistory(v => !v)}
          className={`flex h-7 w-7 items-center justify-center rounded transition ${
            showHistory ? 'bg-accent/10 text-accent' : 'text-text3 hover:bg-surface3 hover:text-text'
          }`}
        >
          <Icon name="history" size={14} />
        </button>

        {/* Sync this entry (opt out keeps it local-only) */}
        {existing && (
          <button type="button"
            title={existing.noSync ? 'Sync this entry' : "Don't sync this entry — keep it local-only"}
            aria-pressed={!!existing.noSync}
            onClick={() => void setEntryNoSync(date, !existing.noSync)}
            className={`flex h-7 w-7 items-center justify-center rounded transition ${
              existing.noSync ? 'bg-accent/10 text-accent' : 'text-text3 hover:bg-surface3 hover:text-text'
            }`}
          >
            <Icon name={existing.noSync ? 'cloud-off' : 'cloud'} size={14} />
          </button>
        )}

        {/* Delete */}
        {existing && (
          <button type="button" title="Delete this entry" onClick={handleDelete}
            className="flex h-7 w-7 items-center justify-center rounded text-text3 transition hover:bg-red-500/10 hover:text-red-400"
          >
            <Icon name="trash-2" size={14} />
          </button>
        )}

        <div className="mx-0.5 h-4 w-px bg-border" />

        {/* Sidebar toggle */}
        <button type="button" title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'} onClick={() => setSidebarOpen(v => !v)}
          className={`flex h-7 w-7 items-center justify-center rounded transition ${
            sidebarOpen ? 'bg-accent/10 text-accent' : 'text-text3 hover:bg-surface3 hover:text-text'
          }`}
        >
          <Icon name={sidebarOpen ? 'panel-right-close' : 'panel-right-open'} size={14} />
        </button>
      </div>

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div ref={editorRootRef} className="flex min-w-0 flex-1 flex-col">
          {readingMode ? (
            <JournalReadingMode date={date} label={label} content={content} />
          ) : (
            <MarkdownEditor
              key={`${date}-${restoreKey}`}
              noteId={date}
              initialMarkdown={content}
              noteTitle={label}
              onChange={setContent}
            />
          )}
        </div>

        {sidebarOpen && (
          <div className="w-[268px] shrink-0 border-l border-border">
            <JournalRightSidebar date={date} label={label} />
          </div>
        )}
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
