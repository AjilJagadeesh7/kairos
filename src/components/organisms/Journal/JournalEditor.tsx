import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { useJournalStore, todayDate } from '../../../store/useJournalStore'
import { useConfirmStore } from '../../../store/useConfirmStore'
import { MarkdownEditor } from '../Editor/MarkdownEditor'
import { NoteAttachmentsPanel } from '../Editor/NoteAttachmentsPanel'
import { HistoryPanel } from '../Editor/HistoryPanel'
import { JournalRightSidebar } from './JournalRightSidebar'
import { JournalReadingMode } from './JournalReadingMode'
import { JournalToolbar } from './JournalToolbar'
import { useIsMobile } from '../../../hooks/useIsMobile'

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

// Compact form for mobile, e.g. "Wed, Jun 11"
function formatShortDate(date: string): string {
  const [y, m, d] = date.split('-').map(Number)
  const dow = new Date(y, m - 1, d).getDay()
  return `${DAY_NAMES[dow].slice(0, 3)}, ${MONTH_NAMES[m - 1].slice(0, 3)} ${d}`
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
  const isMobile = useIsMobile()
  // On mobile the sidebar is an overlay drawer — start closed so content is the hero.
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 768)
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
  const label      = formatDate(date)
  const shortLabel = formatShortDate(date)
  const prevDate = offsetDate(date, -1)
  const nextDate = offsetDate(date, 1)

  return (
    <section className="relative flex h-full flex-col bg-bg">
      <JournalToolbar
        date={date}
        label={label}
        shortLabel={shortLabel}
        isToday={isToday}
        content={content}
        editorRootRef={editorRootRef}
        saveStatus={saveStatus}
        readingMode={readingMode}
        showHistory={showHistory}
        sidebarOpen={sidebarOpen}
        entryExists={!!existing}
        entryNoSync={!!existing?.noSync}
        onPrev={() => navigate(`/journal/${prevDate}`)}
        onNext={() => navigate(`/journal/${nextDate}`)}
        onSave={() => void persist()}
        onToggleReading={() => setReadingMode(v => !v)}
        onToggleHistory={() => setShowHistory(v => !v)}
        onToggleSync={() => { if (existing) void setEntryNoSync(date, !existing.noSync) }}
        onDelete={handleDelete}
        onToggleSidebar={() => setSidebarOpen(v => !v)}
      />

      {/* ── Body ────────────────────────────────────────────────────────── */}
      <div className="flex min-h-0 flex-1 overflow-hidden">
        <div ref={editorRootRef} className="flex min-w-0 flex-1 flex-col">
          {readingMode ? (
            <JournalReadingMode date={date} label={label} content={content} />
          ) : (
            <>
              <div className="min-h-0 flex-1">
                <MarkdownEditor
                  key={`${date}-${restoreKey}`}
                  noteId={date}
                  initialMarkdown={content}
                  noteTitle={label}
                  onChange={setContent}
                  owner={{ type: 'journal', id: date }}
                />
              </div>
              <div className="shrink-0 px-4 pb-3">
                <NoteAttachmentsPanel owner={{ type: 'journal', id: date }} />
              </div>
            </>
          )}
        </div>

        {/* Mobile: overlay drawer so it never steals reading width. Desktop: inline panel. */}
        {isMobile ? (
          sidebarOpen && (
            <>
              <div
                className="fixed inset-0 z-30 bg-black/40 backdrop-blur-[1px]"
                onClick={() => setSidebarOpen(false)}
                aria-hidden
              />
              <div
                className="fixed inset-y-0 right-0 z-40 overflow-hidden border-l border-border bg-surface2"
                style={{ width: Math.min(320, window.innerWidth * 0.85), paddingTop: 'env(safe-area-inset-top)' }}
              >
                <JournalRightSidebar date={date} label={label} />
              </div>
            </>
          )
        ) : (
          sidebarOpen && (
            <div className="w-[268px] shrink-0 border-l border-border">
              <JournalRightSidebar date={date} label={label} />
            </div>
          )
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
