import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, FileDown, History, Save, Trash2 } from 'lucide-react'
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
import type { EditorDraftProps, TagRecord } from '../../../types'

type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved'

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
  const [restoreKey, setRestoreKey]   = useState(0)   // bump to force MarkdownEditor remount on restore
  const deleteNoteById    = useAppStore(s => s.deleteNoteById)
  const updateNoteTags    = useAppStore(s => s.updateNoteTags)
  const keyBindings       = useAppStore(s => s.keyBindings)
  const conflict          = useConflictStore(s => s.conflicts.find(c => c.noteId === note.id))
  const setNoteTagColor   = useAppStore(s => s.setNoteTagColor)
  const noteTagColors     = useAppStore(s => s.noteTagColors)
  const notes             = useAppStore(s => s.notes)
  const navigate          = useNavigate()

  const allTags = useMemo((): TagRecord[] => {
    const tagSet = new Set<string>()
    notes.forEach(n => n.tags.forEach(t => tagSet.add(t)))
    return [...tagSet].sort().map(name => ({
      name,
      color: noteTagColors[name] ?? tagColor(name),
      createdAt: '',
    }))
  }, [notes, noteTagColors])

  const tagMap = useMemo(() => new Map(allTags.map(tag => [tag.name, tag])), [allTags])

  const handleWikilinkClick = useCallback((linkedTitle: string) => {
    const found = notes.find(n => n.title.trim().toLowerCase() === linkedTitle.trim().toLowerCase())
    if (found) navigate(`/notes/${found.id}`)
  }, [notes, navigate])

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

  const saveNote = useCallback(async () => {
    setSaveStatus('saving')
    const t = titleRef.current
    const c = contentRef.current
    const text = `${t}\n\n${c}`
    const embedded = await embedText(note.id, text)
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
    const contentHash = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('')
    await onSave({ title: t || 'Untitled note', content: c, embedding: embedded.embedding, contentHash })
    setSaveStatus('saved')
    setTimeout(() => setSaveStatus((s) => s === 'saved' ? 'idle' : s), 2000)
  }, [note.id, onSave])

  const handleRestore = (restoredContent: string, restoredTitle?: string) => {
    if (restoredTitle) setTitle(restoredTitle)
    setContent(restoredContent)
    setRestoreKey(k => k + 1)   // remounts MarkdownEditor with restored initialMarkdown
    setSaveStatus('dirty')
    setShowHistory(false)
  }

  const saveTags = async (newTags: string[]) => {
    setTags(newTags)
    await updateNoteTags(note.id, newTags)
  }

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (eventMatchesAction(e, 'save-note', keyBindings)) {
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
  }, [saveStatus, saveNote, keyBindings])

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
          {saveStatus === 'saved'  && <><Check size={11} /> Saved</>}
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
          <Save size={14} />
          <span className="hidden sm:inline">Save</span>
        </button>

        <button
          type="button"
          title="Export as PDF"
          onClick={() => exportPDF(editorRootRef.current, titleRef.current || 'Untitled note')}
          className="flex h-[38px] shrink-0 items-center gap-1.5 rounded-md border border-border bg-surface px-3 text-sm font-medium text-text3 transition hover:border-accent/50 hover:text-accent"
        >
          <FileDown size={14} />
          <span className="hidden sm:inline">PDF</span>
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
          <History size={15} />
        </button>

        <button
          type="button"
          title="Delete note"
          onClick={handleDeleteNote}
          className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-md border border-border bg-surface text-text3 transition hover:border-red-400/50 hover:text-red-400"
        >
          <Trash2 size={15} />
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

      <div ref={editorRootRef} className="min-h-0 flex-1 rounded-md border border-border bg-surface">
        <MarkdownEditor key={restoreKey} noteId={note.id} initialMarkdown={content} noteTitle={title} notes={notes} onChange={setContent} onWikilinkClick={(t) => handleWikilinkClick(t)} />
      </div>

      <BacklinksPanel noteTitle={title} />
      <NoteInfoPanel note={note} content={content} />
      </div>

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
