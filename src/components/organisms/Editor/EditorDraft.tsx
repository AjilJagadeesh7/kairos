import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { embedText } from '../../../utils/embeddingClient'
import { useAppStore } from '../../../store/useAppStore'
import { useConfirmStore } from '../../../store/useConfirmStore'
import { TAG_COLOR_PALETTE } from '../../../utils/kanban'
import { TagSelector } from '../../molecules/TagSelector'
import { TagBadge } from '../../atoms/TagBadge'
import { EditorToolbar } from './EditorToolbar'
import { EditorBannerArea } from './EditorBannerArea'
import { EditorReadingMode } from './EditorReadingMode'
import { MarkdownEditor } from './MarkdownEditor'
import { HistoryPanel } from './HistoryPanel'
import { BacklinksPanel } from './BacklinksPanel'
import { NoteInfoPanel } from './NoteInfoPanel'
import { ConflictBanner } from './ConflictBanner'
import { FrontmatterPanel } from './FrontmatterPanel'
import { useConflictStore } from '../../../store/useConflictStore'
import { eventMatchesAction } from '../../../hooks/useShortcutKey'
import type { EditorDraftProps, SaveStatus } from '../../../types'
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
  const deleteNoteById        = useAppStore(s => s.deleteNoteById)
  const updateNoteTags        = useAppStore(s => s.updateNoteTags)
  const updateNoteFrontmatter = useAppStore(s => s.updateNoteFrontmatter)
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
    await exportPDF(editorRootRef.current, titleRef.current || 'Untitled note').finally(() => setExportingPDF(false))
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
        <EditorReadingMode
          note={note}
          title={title}
          content={content}
          restoreKey={restoreKey}
          tags={tags}
          tagMap={tagMap}
          editorRootRef={editorRootRef}
          exportingPDF={exportingPDF}
          onExportPDF={() => void handleExportPDF()}
          onExitReadingMode={() => setReadingMode(false)}
          onContentChange={setContent}
          onWikilinkClick={handleWikilinkClick}
        />
      ) : (
        <div className="flex h-full flex-col overflow-x-hidden overflow-y-auto p-4">
          <EditorBannerArea
            note={note}
            onUpdateFrontmatter={fm => void updateNoteFrontmatter(note.id, fm)}
          />
          <EditorToolbar
            note={note}
            title={title}
            onTitleChange={setTitle}
            saveStatus={saveStatus}
            onSave={() => void saveNote()}
            exportingPDF={exportingPDF}
            onExportPDF={() => void handleExportPDF()}
            showHistory={showHistory}
            onToggleHistory={() => setShowHistory(h => !h)}
            onReadingMode={() => setReadingMode(true)}
            onDelete={handleDeleteNote}
          />

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

          <div ref={editorRootRef} className="min-h-[240px] rounded-md border border-border bg-surface md:min-h-0 md:flex-1">
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

          <div className="mt-2 flex flex-col gap-2">
            <FrontmatterPanel note={note} />
            <NoteInfoPanel note={note} content={content} />
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
