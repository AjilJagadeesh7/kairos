import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import { embedText } from '../utils/embeddingClient'
import { useAppStore } from '../store/useAppStore'
import { useConfirmStore } from '../store/useConfirmStore'
import { useHistoryRequestStore } from '../store/useHistoryRequestStore'
import { tagColorFromName } from '../utils/kanban'
import { eventMatchesAction } from './useShortcutKey'
import type { EditorDraftProps, SaveStatus, TagRecord } from '../types'

/** Past this size the editor warns that typing may get sluggish. */
const LARGE_NOTE_BYTES = 150_000

/**
 * Everything stateful behind the note editor: the working copy of the note, the
 * debounced save (with content hashing and embedding refresh), tag edits,
 * history restore, and the editor's keyboard shortcuts. `EditorDraft` renders
 * what this returns.
 */
export function useNoteDraft({ note, onSave }: EditorDraftProps) {
  const [title,       setTitle]       = useState(note.title)
  const [content,     setContent]     = useState(note.content)
  const [tags,        setTags]        = useState<string[]>(note.tags)
  const [saveStatus,  setSaveStatus]  = useState<SaveStatus>('idle')
  const [showHistory, setShowHistory] = useState(false)
  const [readingMode, setReadingMode] = useState(false)
  const [restoreKey,  setRestoreKey]  = useState(0)
  const [largeDismissed, setLargeDismissed] = useState(false)

  const deleteNoteById        = useAppStore(s => s.deleteNoteById)
  const updateNoteTags        = useAppStore(s => s.updateNoteTags)
  const updateNoteFrontmatter = useAppStore(s => s.updateNoteFrontmatter)
  const setNoteTagColor       = useAppStore(s => s.setNoteTagColor)
  const noteTagColors         = useAppStore(s => s.noteTagColors)
  const keyBindings           = useAppStore(s => s.keyBindings)
  const allTagNames           = useAppStore(s => {
    const tagSet = new Set<string>()
    s.notes.forEach(n => n.tags.forEach(t => tagSet.add(t)))
    return [...tagSet].sort().join('\0')
  })
  const navigate = useNavigate()

  const titleRef   = useRef(title)
  const contentRef = useRef(content)
  useEffect(() => { titleRef.current   = title   }, [title])
  useEffect(() => { contentRef.current = content }, [content])

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

  const allTags = useMemo((): TagRecord[] =>
    allTagNames ? allTagNames.split('\0').map(name => ({
      name,
      color: noteTagColors[name] ?? tagColorFromName(name),
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

  const handleDeleteNote = useCallback(() => {
    void useConfirmStore.getState()
      .confirm({
        title: `Delete "${titleRef.current || 'Untitled note'}"?`,
        message: 'This cannot be undone.',
        confirmLabel: 'Delete',
        danger: true,
      })
      .then((ok) => { if (ok) void deleteNoteById(note.id) })
  }, [deleteNoteById, note.id])

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
      const { upsertEmbedding } = await import('../db/schema')
      await upsertEmbedding(note.id, embedding, contentHash)
    }).catch(() => { /* best-effort */ })
  }, [note.id, onSave])

  const handleRestore = useCallback((restoredContent: string, restoredTitle?: string) => {
    const newTitle = restoredTitle ?? titleRef.current
    titleRef.current   = newTitle
    contentRef.current = restoredContent
    if (restoredTitle) setTitle(newTitle)
    setContent(restoredContent)
    setRestoreKey(k => k + 1)
    setShowHistory(false)
    void saveNote()
  }, [saveNote])

  const saveTags = useCallback(async (newTags: string[]) => {
    setTags(newTags)
    await updateNoteTags(note.id, newTags)
  }, [note.id, updateNoteTags])

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
  }, [saveStatus, saveNote, keyBindings, readingMode, handleDeleteNote])

  useEffect(() => {
    if (title === note.title && content === note.content) return
    setSaveStatus('dirty')
    const handle = window.setTimeout(() => void saveNote(), 2000)
    return () => window.clearTimeout(handle)
  }, [title, content]) // eslint-disable-line react-hooks/exhaustive-deps

  const isLargeNote = !largeDismissed
    && new TextEncoder().encode(content).length > LARGE_NOTE_BYTES

  return {
    title, setTitle,
    content, setContent,
    tags, allTags, tagMap, saveTags, setNoteTagColor,
    saveStatus, saveNote,
    showHistory, setShowHistory,
    readingMode, setReadingMode,
    restoreKey, handleRestore,
    isLargeNote, dismissLargeNote: () => setLargeDismissed(true),
    handleWikilinkClick, handleDeleteNote,
    updateNoteFrontmatter,
  }
}
