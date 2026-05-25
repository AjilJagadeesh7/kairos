import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { embedText } from '../../../utils/embeddingClient'
import { useAppStore } from '../../../store/useAppStore'
import { useConfirmStore } from '../../../store/useConfirmStore'
import { TAG_COLOR_PALETTE } from '../../../utils/kanban'
import { TagSelector } from '../../molecules/TagSelector'
import { TagBadge } from '../../atoms/TagBadge'
import { exportPDF } from './exportPDF'
import { MarkdownEditor } from './MarkdownEditor'
import { HistoryPanel } from './HistoryPanel'
import { BacklinksPanel } from './BacklinksPanel'
import { NoteInfoPanel } from './NoteInfoPanel'
import { ConflictBanner } from './ConflictBanner'
import { useConflictStore } from '../../../store/useConflictStore'
import { eventMatchesAction } from '../../../hooks/useShortcutKey'
import type { EditorDraftProps, TagRecord, SaveStatus } from '../../../types'
import { Icon } from '../../../icons/Icon'

function tagColor(name: string): string {
  let h = 5381
  for (let i = 0; i < name.length; i++) h = ((h << 5) + h) ^ name.charCodeAt(i)
  return TAG_COLOR_PALETTE[Math.abs(h) % TAG_COLOR_PALETTE.length]
}

export function EditorDraft({ note, onSave }: EditorDraftProps): JSX.Element {
  const [title, setTitle]           = useState(note.title)
  const [content, setContent]       = useState(note.content)
  const [tags, setTags]             = useState<string[]>(note.tags)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [showHistory, setShowHistory] = useState(false)
  const [readingMode, setReadingMode] = useState(false)
  const [restoreKey, setRestoreKey]   = useState(0)   // bump to force MarkdownEditor remount on restore
  const [exportingPDF, setExportingPDF] = useState(false)
  const [largeDismissed, setLargeDismissed] = useState(false)

  const LARGE_NOTE_BYTES = 150_000
  const isLargeNote = !largeDismissed && new TextEncoder().encode(content).length > LARGE_NOTE_BYTES
  const deleteNoteById    = useAppStore(s => s.deleteNoteById)
  const updateNoteTags    = useAppStore(s => s.updateNoteTags)
  const keyBindings       = useAppStore(s => s.keyBindings)
  const conflict          = useConflictStore(s => s.conflicts.find(c => c.noteId === note.id))
  const setNoteTagColor   = useAppStore(s => s.setNoteTagColor)
  const noteTagColors     = useAppStore(s => s.noteTagColors)
  // Subscribe only to the sorted list of tag names — never re-fires on content/updatedAt saves.
  const allTagNames       = useAppStore(s => {
    const tagSet = new Set<string>()
    s.notes.forEach(n => n.tags.forEach(t => tagSet.add(t)))
    return [...tagSet].sort().join('\0')
  })
  const navigate          = useNavigate()

  const allTags = useMemo((): TagRecord[] =>
    allTagNames ? allTagNames.split('\0').map(name => ({
      name,
      color: noteTagColors[name] ?? tagColor(name),
      createdAt: '',
    })) : []
  , [allTagNames, noteTagColors])

  const tagMap = useMemo(() => new Map(allTags.map(tag => [tag.name, tag])), [allTags])

  // Read from store snapshot at click time — no subscription needed.
  const handleWikilinkClick = useCallback((linkedTitle: string) => {
    const found = useAppStore.getState().notes.find(
      n => n.title.trim().toLowerCase() === linkedTitle.trim().toLowerCase()
    )
    if (found) navigate(`/notes/${found.id}`)
  }, [navigate])

  const editorRootRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef(title)
  const contentRef = useRef(content)
  useEffect(() => { titleRef.current = title }, [title])
  useEffect(() => { contentRef.current = content }, [content])

  const handleExportPDF = async () => {
    setExportingPDF(true)
    try {
      await exportPDF(editorRootRef.current, titleRef.current || 'Untitled note')
    } finally {
      setExportingPDF(false)
    }
  }

  const handleDeleteNote = () => {
    void useConfirmStore.getState()
      .confirm({
        title: `Delete "${title || 'Untitled note'}"?`,
        message: 'This cannot be undone.',
        confirmLabel: 'Delete',
        danger: true,
      })
      .then((ok) => { if (ok) void deleteNoteById(note.id) })
  }

  const lastSavedHashRef = useRef<string>('')

  const saveNote = useCallback(async () => {
    const t = titleRef.current
    const c = contentRef.current
    const text = `${t}\n\n${c}`
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
    const contentHash = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')

    // Skip redundant saves — rapid typing queues multiple debounced calls but
    // the content may be identical by the time each fires.
    if (contentHash === lastSavedHashRef.current) {
      setSaveStatus('idle')
      return
    }
    lastSavedHashRef.current = contentHash

    setSaveStatus('saving')
    // Save immediately with empty embedding so the note persists fast,
    // then compute embedding in the background and upsert separately
    await onSave({ title: t || 'Untitled note', content: c, embedding: [], contentHash })
    setSaveStatus('saved')
    setTimeout(() => setSaveStatus((s) => s === 'saved' ? 'idle' : s), 2000)
    // Fire-and-forget: compute embedding without blocking the save response
    void embedText(note.id, text).then(async ({ embedding }) => {
      if (!embedding.length) return
      const { upsertEmbedding } = await import('../../../db/schema')
      await upsertEmbedding(note.id, embedding, contentHash)
    }).catch(() => { /* embedding is best-effort */ })
  }, [note.id, onSave])

  const handleRestore = (restoredContent: string, restoredTitle?: string) => {
    const newTitle = restoredTitle ?? titleRef.current
    // Update refs immediately so saveNote reads the restored values
    titleRef.current   = newTitle
    contentRef.current = restoredContent
    if (restoredTitle) setTitle(newTitle)
    setContent(restoredContent)
    setRestoreKey(k => k + 1)
    setShowHistory(false)
    void saveNote()
  }

  const saveTags = async (newTags: string[]) => {
    setTags(newTags)
    await updateNoteTags(note.id, newTags)
  }

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && readingMode) {
        setReadingMode(false)
      } else if (eventMatchesAction(e, 'save-note', keyBindings)) {
        e.preventDefault()
        if (saveStatus === 'dirty') void saveNote()
      } else if (eventMatchesAction(e, 'delete-note', keyBindings)) {
        e.preventDefault()
        handleDeleteNote()
      } else if (eventMatchesAction(e, 'toggle-history', keyBindings)) {
        e.preventDefault()
        setShowHistory(v => !v)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [saveStatus, saveNote, keyBindings, readingMode])

  useEffect(() => {
    if (title === note.title && content === note.content) return
    setSaveStatus('dirty')
    const handle = window.setTimeout(() => void saveNote(), 2000)
    return () => window.clearTimeout(handle)
  }, [title, content]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section className="relative flex h-full flex-col bg-bg">
      {conflict && (
        <ConflictBanner
          conflict={conflict}
          onApplyRemote={(newContent, newTitle) => {
            setContent(newContent)
            setTitle(newTitle)
          }}
        />
      )}

      {readingMode ? (
        /* ── Reading mode ─────────────────────────────────────────── */
        <div className="flex h-full flex-col overflow-hidden">
          {/* Minimal reading toolbar */}
          <div className="flex shrink-0 items-center justify-between border-b border-border px-6 py-2">
            <div className="flex flex-wrap gap-1">
              {tags.map((tagName) => {
                const tag = tagMap.get(tagName)
                return tag ? <TagBadge key={tagName} tag={tag} variant="md" /> : null
              })}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                title="Export as PDF"
                onClick={() => void handleExportPDF()}
                disabled={exportingPDF}
                className="flex h-[32px] items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 text-xs font-medium text-text3 transition hover:border-accent/50 hover:text-accent disabled:opacity-50"
              >
                <Icon name={exportingPDF ? 'loader-2' : 'file-down'} size={13} className={exportingPDF ? 'animate-spin' : ''} />
                <span>{exportingPDF ? 'Exporting…' : 'PDF'}</span>
              </button>
              <button
                type="button"
                title="Switch to edit mode (Esc)"
                onClick={() => setReadingMode(false)}
                className="flex h-[32px] items-center gap-1.5 rounded-md border border-accent/40 bg-accent/10 px-2.5 text-xs font-medium text-accent transition hover:bg-accent/20"
              >
                <Icon name="pencil" size={13} />
                <span>Edit</span>
              </button>
            </div>
          </div>

          {/* Reading content */}
          <div ref={editorRootRef} className="min-h-0 flex-1 overflow-y-auto p-4">
            <h1 className="mb-4 text-2xl font-bold leading-tight text-text">{title || 'Untitled note'}</h1>
            <div className="reading-view">
              <MarkdownEditor
                key={restoreKey}
                noteId={note.id}
                initialMarkdown={content}
                noteTitle={title}

                readOnly
                onChange={setContent}
                onWikilinkClick={(t) => handleWikilinkClick(t)}
              />
            </div>
          </div>
        </div>
      ) : (
        /* ── Edit mode ────────────────────────────────────────────── */
        <div className="flex h-full flex-col p-4">
          <div className="mb-2 flex items-center gap-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="min-w-0 flex-1 rounded-md border border-border bg-surface px-3 py-2 text-lg font-bold text-text outline-none placeholder:text-text3 focus:border-text2"
              placeholder="Note title"
            />

            <span className={`hidden shrink-0 text-xs transition-all sm:inline-flex items-center gap-1 ${
              saveStatus === 'idle' ? 'opacity-0 pointer-events-none' : 'opacity-100'
            } ${saveStatus === 'saved' ? 'text-green-500' : 'text-text3'}`}>
              {saveStatus === 'saving' && 'Saving…'}
              {saveStatus === 'saved'  && <><Icon name="check" size={11} /> Saved</>}
              {saveStatus === 'dirty'  && 'Unsaved'}
            </span>

            <button
              type="button"
              onClick={() => void saveNote()}
              disabled={saveStatus === 'saving' || saveStatus === 'idle'}
              title={saveStatus === 'dirty' ? 'Save now (⌘S)' : 'No unsaved changes'}
              className={`flex h-[38px] shrink-0 items-center gap-1.5 rounded-md border px-3 text-sm font-medium transition ${
                saveStatus === 'dirty'
                  ? 'border-accent/40 bg-accent/10 text-accent hover:bg-accent/20'
                  : 'cursor-default border-border bg-surface text-text3 opacity-40'
              }`}
            >
              <Icon name="save" size={14} />
              <span className="hidden sm:inline">Save</span>
            </button>

            <button
              type="button"
              title="Export as PDF"
              onClick={() => void handleExportPDF()}
              disabled={exportingPDF}
              className="flex h-[38px] shrink-0 items-center gap-1.5 rounded-md border border-border bg-surface px-3 text-sm font-medium text-text3 transition hover:border-accent/50 hover:text-accent disabled:opacity-50"
            >
              <Icon name={exportingPDF ? 'loader-2' : 'file-down'} size={14} className={exportingPDF ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">{exportingPDF ? 'Exporting…' : 'PDF'}</span>
            </button>

            <button
              type="button"
              title="Reading mode"
              onClick={() => setReadingMode(true)}
              className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-md border border-border bg-surface text-text3 transition hover:border-accent/50 hover:text-accent"
            >
              <Icon name="eye" size={15} />
            </button>

            <button
              type="button"
              title="Version history"
              onClick={() => setShowHistory(h => !h)}
              className={`flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-md border transition ${
                showHistory
                  ? 'border-accent/40 bg-accent/10 text-accent'
                  : 'border-border bg-surface text-text3 hover:border-accent/50 hover:text-accent'
              }`}
            >
              <Icon name="history" size={15} />
            </button>

            <button
              type="button"
              title="Delete note"
              onClick={handleDeleteNote}
              className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-md border border-border bg-surface text-text3 transition hover:border-red-400/50 hover:text-red-400"
            >
              <Icon name="trash-2" size={15} />
            </button>
          </div>

          <div className="mb-3 flex flex-wrap items-center gap-2">
            <TagSelector
              selectedTags={tags}
              onTagsChange={saveTags}
              onTagCreate={(name, color) => setNoteTagColor(name, color)}
              availableTags={allTags}
            />
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {tags.map((tagName) => {
                  const tag = tagMap.get(tagName)
                  return tag ? (
                    <TagBadge key={tagName} tag={tag} onRemove={() => void saveTags(tags.filter((t) => t !== tagName))} variant="md" />
                  ) : null
                })}
              </div>
            )}
          </div>

          {isLargeNote && (
            <div className="mb-2 flex items-center gap-2 rounded-xl border border-amber-400/40 bg-amber-50/60 px-3 py-2 dark:bg-amber-950/20">
              <Icon name="alert-triangle" size={13} className="shrink-0 text-amber-500" />
              <p className="flex-1 text-[11px] text-amber-700 dark:text-amber-400">
                This note is large (&gt;150 KB). The editor may be slower than usual — consider splitting it into smaller notes.
              </p>
              <button type="button" onClick={() => setLargeDismissed(true)} className="text-amber-500 hover:text-amber-700">
                <Icon name="x" size={13} />
              </button>
            </div>
          )}

          <div ref={editorRootRef} className="min-h-0 flex-1 rounded-md border border-border bg-surface">
            <MarkdownEditor
              key={restoreKey}
              noteId={note.id}
              initialMarkdown={content}
              noteTitle={title}
              onChange={setContent}
              onWikilinkClick={(t) => handleWikilinkClick(t)}
            />
          </div>

          <BacklinksPanel noteTitle={title} />
          <NoteInfoPanel note={note} content={content} />
        </div>
      )}

      {showHistory && (
        <HistoryPanel
          id={note.id}
          type="note"
          onRestore={handleRestore}
          onClose={() => setShowHistory(false)}
        />
      )}
    </section>
  )
}
