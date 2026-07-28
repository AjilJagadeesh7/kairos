import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { embedText } from '../../../utils/embeddingClient'
import { useAppStore } from '../../../store/useAppStore'
import { useConfirmStore } from '../../../store/useConfirmStore'
import { useHistoryRequestStore } from '../../../store/useHistoryRequestStore'
import { TAG_COLOR_PALETTE } from '../../../utils/kanban'
import { EditorToolbar } from './EditorToolbar'
import { SlotRenderer } from '../../molecules/SlotRenderer'
import { EditorBannerArea } from './EditorBannerArea'
import { EditorReadingMode } from './EditorReadingMode'
import { MarkdownEditor } from './MarkdownEditor'
import { HistoryPanel } from './HistoryPanel'
import { NoteRightSidebar } from './NoteRightSidebar'
import { ConflictBanner } from './ConflictBanner'
import { useConflictStore } from '../../../store/useConflictStore'
import { eventMatchesAction } from '../../../hooks/useShortcutKey'
import { useIsMobile } from '../../../hooks/useIsMobile'
import { Icon } from '../../../icons/Icon'
import type { EditorDraftProps, SaveStatus, TagRecord } from '../../../types'

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
  const isMobile = useIsMobile()
  // On mobile the sidebar is an overlay drawer — start closed so content is the hero.
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 768)
  const [sidebarWidth, setSidebarWidth] = useState(268)
  const [restoreKey, setRestoreKey]   = useState(0)
  const [largeDismissed, setLargeDismissed] = useState(false)

  // Open the history panel when requested from the note context menu (sidebar).
  useEffect(() => {
    const maybeOpen = (requestedId: string | null) => {
      if (requestedId !== note.id) return
      setShowHistory(true)
      useHistoryRequestStore.getState().clear()
    }
    maybeOpen(useHistoryRequestStore.getState().requestedNoteId)
    return useHistoryRequestStore.subscribe(s => maybeOpen(s.requestedNoteId))
  }, [note.id])

  const LARGE_NOTE_BYTES = 150_000
  const isLargeNote = !largeDismissed && new TextEncoder().encode(content).length > LARGE_NOTE_BYTES
  const deleteNoteById        = useAppStore(s => s.deleteNoteById)
  const updateNoteTags        = useAppStore(s => s.updateNoteTags)
  const updateNoteFrontmatter = useAppStore(s => s.updateNoteFrontmatter)
  const keyBindings       = useAppStore(s => s.keyBindings)
  const conflict          = useConflictStore(s => s.conflicts.find(c => c.noteId === note.id))
  const setNoteTagColor   = useAppStore(s => s.setNoteTagColor)
  const noteTagColors     = useAppStore(s => s.noteTagColors)
  const allTagNames       = useAppStore(s => {
    const tagSet = new Set<string>()
    s.notes.forEach(n => n.tags.forEach(t => tagSet.add(t)))
    return [...tagSet].sort().join('\0')
  })
  const navigate = useNavigate()

  const allTags = useMemo((): TagRecord[] =>
    allTagNames ? allTagNames.split('\0').map(name => ({
      name,
      color: noteTagColors[name] ?? tagColor(name),
      createdAt: '',
    })) : []
  , [allTagNames, noteTagColors])

  const tagMap = useMemo(() => new Map(allTags.map(tag => [tag.name, tag])), [allTags])

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

    if (contentHash === lastSavedHashRef.current) { setSaveStatus('idle'); return }
    lastSavedHashRef.current = contentHash
    setSaveStatus('saving')
    await onSave({ title: t || 'Untitled note', content: c, embedding: [], contentHash })
    setSaveStatus('saved')
    setTimeout(() => setSaveStatus((s) => s === 'saved' ? 'idle' : s), 2000)
    void embedText(note.id, text).then(async ({ embedding }) => {
      if (!embedding.length) return
      const { upsertEmbedding } = await import('../../../db/schema')
      await upsertEmbedding(note.id, embedding, contentHash)
    }).catch(() => { /* best-effort */ })
  }, [note.id, onSave])

  const handleRestore = (restoredContent: string, restoredTitle?: string) => {
    const newTitle = restoredTitle ?? titleRef.current
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
  }, [saveStatus, saveNote, keyBindings, readingMode]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (title === note.title && content === note.content) return
    setSaveStatus('dirty')
    const handle = window.setTimeout(() => void saveNote(), 2000)
    return () => window.clearTimeout(handle)
  }, [title, content]) // eslint-disable-line react-hooks/exhaustive-deps

  // Pointer events (not mouse events) so touch/pen can resize on tablets.
  function startResize(e: React.PointerEvent) {
    e.preventDefault()
    const startX = e.clientX
    const startW = sidebarWidth

    const onMove = (ev: PointerEvent) => {
      const delta = startX - ev.clientX   // drag left → wider
      setSidebarWidth(Math.max(200, Math.min(520, startW + delta)))
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onUp)
  }

  return (
    <section className="relative flex h-full flex-col bg-bg">
      {conflict && (
        <ConflictBanner
          conflict={conflict}
          onApplyRemote={(newContent, newTitle) => { setContent(newContent); setTitle(newTitle) }}
        />
      )}

      {readingMode ? (
        <EditorReadingMode
          note={note} title={title} content={content} restoreKey={restoreKey}
          tags={tags} tagMap={tagMap} editorRootRef={editorRootRef}
          onExitReadingMode={() => setReadingMode(false)}
          onContentChange={setContent}
          onWikilinkClick={handleWikilinkClick}
        />
      ) : (
        <div className="flex h-full flex-col overflow-hidden">
          <EditorToolbar
            note={note}
            noteTitle={title}
            saveStatus={saveStatus}
            onSave={() => void saveNote()}
            showHistory={showHistory}
            onToggleHistory={() => setShowHistory(h => !h)}
            onReadingMode={() => setReadingMode(true)}
            onDelete={handleDeleteNote}
            sidebarOpen={sidebarOpen}
            onToggleSidebar={() => setSidebarOpen(v => !v)}
          />

          <div className="flex flex-1 min-h-0 overflow-hidden">
            {/* ── Main writing area ─────────────────────────────────────── */}
            {/* No overflow here — .ProseMirror is the scroll container (see index.css).
                min-h-0 lets the flex chain constrain ProseMirror's height so it scrolls. */}
            <div className="flex flex-1 min-h-0 flex-col">
              <div ref={editorRootRef} className="flex flex-1 min-h-0 flex-col p-2">
                {/* Pre-editor elements — shrink-0 so they don't compete with the editor for height.
                    px-11 matches the ProseMirror content padding below so the title aligns with the
                    body; the gutter is sized to fit Crepe's block (drag) handle on the left. */}
                <div className="shrink-0 px-11">
                  <EditorBannerArea
                    note={note}
                    onUpdateFrontmatter={fm => void updateNoteFrontmatter(note.id, fm)}
                  />

                  {isLargeNote && (
                    <div className="mb-3 flex items-center gap-2 rounded-xl border border-amber-400/40 bg-amber-50/60 px-3 py-2 dark:bg-amber-950/20">
                      <Icon name="alert-triangle" size={13} className="shrink-0 text-amber-500" />
                      <p className="flex-1 text-[11px] text-amber-700 dark:text-amber-400">
                        This note is large (&gt;150 KB). The editor may be slower — consider splitting it.
                      </p>
                      <button type="button" onClick={() => setLargeDismissed(true)} className="text-amber-500 hover:text-amber-700">
                        <Icon name="x" size={13} />
                      </button>
                    </div>
                  )}

                  <input
                    value={title}
                    onChange={e => setTitle(e.target.value)}
                    className="w-full bg-transparent text-[26px] font-bold leading-tight text-text outline-none placeholder:text-text3"
                    placeholder="Untitled note"
                  />

                  <hr className="my-4 border-border" />
                  <SlotRenderer
                    slot="editor:title:below"
                    props={{ noteId: note.id, noteTitle: title }}
                  />
                </div>

                {/* Editor fills remaining height — ProseMirror scrolls internally */}
                <div className="flex-1 min-h-0">
                  <MarkdownEditor
                    key={restoreKey}
                    noteId={note.id}
                    initialMarkdown={content}
                    noteTitle={title}
                    onChange={setContent}
                    onWikilinkClick={handleWikilinkClick}
                    enableAttachments
                  />
                </div>
              </div>
            </div>

            {/* ── Resize handle + right sidebar ─────────────────────────── */}
            {/* Mobile: render as an overlay drawer so it never steals reading width. */}
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
                    <NoteRightSidebar
                      note={note}
                      content={content}
                      title={title}
                      tags={tags}
                      tagMap={tagMap}
                      allTags={allTags}
                      onTagsChange={saveTags}
                      onTagCreate={(name, color) => setNoteTagColor(name, color)}
                    />
                  </div>
                </>
              )
            ) : (
              sidebarOpen && (
                <>
                  {/* Drag handle — sits on the border, widens hit area with padding */}
                  <div
                    className="group relative z-10 w-1 shrink-0 cursor-col-resize touch-none bg-border transition-colors hover:bg-accent/50 active:bg-accent"
                    onPointerDown={startResize}
                  >
                    {/* Wider invisible hit area */}
                    <div className="absolute inset-y-0 -left-1.5 -right-1.5" />
                  </div>

                  <div style={{ width: sidebarWidth }} className="shrink-0 overflow-hidden">
                    <NoteRightSidebar
                      note={note}
                      content={content}
                      title={title}
                      tags={tags}
                      tagMap={tagMap}
                      allTags={allTags}
                      onTagsChange={saveTags}
                      onTagCreate={(name, color) => setNoteTagColor(name, color)}
                    />
                  </div>
                </>
              )
            )}
          </div>
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
