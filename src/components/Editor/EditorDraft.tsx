import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, FileDown, Save, Trash2 } from 'lucide-react'
import { db } from '../../db/schema'
import { embedText } from '../../utils/embeddingClient'
import { useAppStore } from '../../store/useAppStore'
import { useConfirmStore } from '../../store/useConfirmStore'
import { Button } from '../ui/Button'
import { TagSelector } from '../Tags/TagSelector'
import { TagBadge } from '../Tags/TagBadge'
import { exportPDF } from './exportPDF'
import { MarkdownEditor } from './MarkdownEditor'
import type { EditorDraftProps } from './types'
import { useLiveQuery } from 'dexie-react-hooks'
import { getAllTags } from '../../db/schema'
import type { TagRecord } from '../../types'

type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved'

export function EditorDraft({ note, onSave }: EditorDraftProps): JSX.Element {
  const [title, setTitle] = useState(note.title)
  const [content, setContent] = useState(note.content)
  const [tags, setTags] = useState<string[]>(note.tags)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const deleteNoteById = useAppStore((s) => s.deleteNoteById)
  const navigate = useNavigate()
  const allTags = useLiveQuery(() => getAllTags())
  const tagMap = new Map((allTags ?? []).map((tag) => [tag.name, tag]))

  const handleWikilinkClick = useCallback(async (linkedTitle: string) => {
    const found = await db.notes
      .filter((n) => n.title.trim().toLowerCase() === linkedTitle.trim().toLowerCase())
      .first()
    if (found) navigate(`/notes/${found.id}`)
  }, [navigate])

  // Keep stable refs so saveNote can always read current values
  const editorRootRef = useRef<HTMLDivElement>(null)

  // Keep stable refs so saveNote can always read current values
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
    // Reset to idle after brief "Saved" confirmation
    setTimeout(() => setSaveStatus((s) => s === 'saved' ? 'idle' : s), 2000)
  }, [note.id, onSave])

  // When the active note changes (without unmounting), reset all local state
  const prevNoteIdRef = useRef(note.id)
  useEffect(() => {
    if (prevNoteIdRef.current === note.id) return
    prevNoteIdRef.current = note.id
    setTitle(note.title)
    setContent(note.content)
    setTags(note.tags)
    setSaveStatus('idle')
  }, [note])

  const saveTags = async (newTags: string[]) => {
    setTags(newTags)
    await db.notes.update(note.id, { tags: newTags })
  }

  // Keyboard shortcut: Ctrl+S / Cmd+S
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        if (saveStatus === 'dirty') void saveNote()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [saveStatus, saveNote])

  // Mark dirty immediately on any change, then debounce auto-save 2s after last input
  useEffect(() => {
    // Don't trigger on first mount (content matches note.content)
    if (title === note.title && content === note.content) return
    setSaveStatus('dirty')
    const handle = window.setTimeout(() => void saveNote(), 2000)
    return () => window.clearTimeout(handle)
  }, [title, content]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <section className="flex h-full flex-col bg-bg p-4">
      {/* Title row: title input + save status + save button + delete */}
      <div className="mb-2 flex items-center gap-2">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="min-w-0 flex-1 rounded-md border border-border bg-surface px-3 py-2 text-lg font-bold text-text outline-none placeholder:text-text3 focus:border-text2"
          placeholder="Note title"
        />

        {/* Save status pill — only visible when something is happening */}
        <span className={`hidden shrink-0 text-xs transition-all sm:inline-flex items-center gap-1 ${
          saveStatus === 'idle' ? 'opacity-0 pointer-events-none' : 'opacity-100'
        } ${saveStatus === 'saved' ? 'text-green-500' : 'text-text3'}`}>
          {saveStatus === 'saving' && 'Saving…'}
          {saveStatus === 'saved'  && <><Check size={11} /> Saved</>}
          {saveStatus === 'dirty'  && 'Unsaved'}
        </span>

        {/* Save button — accent when dirty, muted when clean */}
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
          title="Delete note"
          onClick={handleDeleteNote}
          className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-md border border-border bg-surface text-text3 transition hover:border-red-400/50 hover:text-red-400"
        >
          <Trash2 size={15} />
        </button>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <TagSelector selectedTags={tags} onTagsChange={saveTags} />
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {tags.map((tagName) => {
              const tag = tagMap.get(tagName)
              return tag ? (
                <TagBadge key={tagName} tag={tag} onRemove={() => saveTags(tags.filter((t) => t !== tagName))} variant="md" />
              ) : null
            })}
          </div>
        )}
      </div>

      <div ref={editorRootRef} className="min-h-0 flex-1 rounded-md border border-border bg-surface">
        <MarkdownEditor noteId={note.id} initialMarkdown={note.content} noteTitle={title} onChange={setContent} onWikilinkClick={(t) => { void handleWikilinkClick(t) }} />
      </div>
    </section>
  )
}
