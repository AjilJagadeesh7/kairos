import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, FileDown, Plus, Save, Tag, Trash2, X } from 'lucide-react'
import { db } from '../../db/schema'
import { embedText } from '../../utils/embeddingClient'
import { useAppStore } from '../../store/useAppStore'
import { useConfirmStore } from '../../store/useConfirmStore'
import { Button } from '../ui/Button'
import { exportPDF } from './exportPDF'
import { MarkdownEditor } from './MarkdownEditor'
import type { EditorDraftProps } from './types'

type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved'

export function EditorDraft({ note, onSave }: EditorDraftProps): JSX.Element {
  const [title, setTitle] = useState(note.title)
  const [content, setContent] = useState(note.content)
  const [tags, setTags] = useState<string[]>(note.tags)
  const [tagInput, setTagInput] = useState('')
  const [showTagInput, setShowTagInput] = useState(false)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const deleteNoteById = useAppStore((s) => s.deleteNoteById)
  const navigate = useNavigate()

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
    setTagInput('')
    setShowTagInput(false)
    setSaveStatus('idle')
  }, [note])

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

  const saveTags = async (newTags: string[]) => {
    setTags(newTags)
    await db.notes.update(note.id, { tags: newTags })
  }

  const addTag = async () => {
    const t = tagInput.trim().toLowerCase().replace(/^#/, '').replace(/\s+/g, '-')
    if (!t || tags.includes(t)) { setTagInput(''); setShowTagInput(false); return }
    await saveTags([...tags, t])
    setTagInput('')
    setShowTagInput(false)
  }

  const removeTag = (tag: string) => void saveTags(tags.filter((t) => t !== tag))

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

      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        {tags.map((tag) => (
          <span key={tag} className="inline-flex items-center gap-1 rounded-full border border-border bg-surface2 px-2 py-0.5 text-xs text-text2">
            <Tag size={10} />#{tag}
            <button onClick={() => removeTag(tag)} className="ml-0.5 text-text3 hover:text-text transition"><X size={10} /></button>
          </span>
        ))}
        {showTagInput ? (
          <form onSubmit={(e) => { e.preventDefault(); void addTag() }} className="inline-flex items-center gap-1">
            <input
              autoFocus
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onBlur={() => { void addTag() }}
              onKeyDown={(e) => { if (e.key === 'Escape') { setTagInput(''); setShowTagInput(false) } }}
              placeholder="tag-name"
              className="w-24 rounded border border-border bg-surface px-2 py-0.5 text-xs text-text outline-none focus:border-text2"
            />
          </form>
        ) : (
          <Button variant="ghost" size="xs" onClick={() => setShowTagInput(true)} className="inline-flex items-center gap-1 opacity-60 hover:opacity-100">
            <Plus size={11} /> Tag
          </Button>
        )}
      </div>

      <div ref={editorRootRef} className="min-h-0 flex-1 rounded-md border border-border bg-surface">
        <MarkdownEditor noteId={note.id} initialMarkdown={note.content} noteTitle={title} onChange={setContent} onWikilinkClick={(t) => { void handleWikilinkClick(t) }} />
      </div>
    </section>
  )
}
