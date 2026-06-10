import { useCallback, useEffect, useState } from 'react'
import { usePenNoteStore } from '../../../store/usePenNoteStore'
import { usePenNoteHistoryStore } from '../../../store/usePenNoteHistoryStore'
import { IconButton } from '../../atoms/IconButton'
import { Icon } from '../../../icons/Icon'
import { PenCanvas } from './PenCanvas'
import { PenNoteRightSidebar } from './PenNoteRightSidebar'
import { PenNoteHistoryPanel } from './PenNoteHistoryPanel'
import type { PenNote, PenStroke } from '../../../types'

interface Props {
  penNote: PenNote
  onDelete: () => void
  onSelectionToText?: (selected: PenStroke[]) => void
  toTextAvailable?: boolean
}

export function PenNoteEditor({ penNote, onDelete, onSelectionToText, toTextAvailable }: Props): JSX.Element {
  const updateStrokes = usePenNoteStore(s => s.updateStrokes)
  const setHeight = usePenNoteStore(s => s.setHeight)
  const updateTitle = usePenNoteStore(s => s.updateTitle)
  const record = usePenNoteHistoryStore(s => s.record)

  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [showHistory, setShowHistory] = useState(false)
  const [lastSavedAt, setLastSavedAt] = useState(penNote.updatedAt)
  const [justSaved, setJustSaved] = useState(false)

  const dirty = penNote.updatedAt !== lastSavedAt
  const saveStatus: 'idle' | 'dirty' | 'saved' = justSaved ? 'saved' : dirty ? 'dirty' : 'idle'

  const doSave = useCallback(() => {
    record(penNote.id, penNote.strokes)
    setLastSavedAt(penNote.updatedAt)
    setJustSaved(true)
    window.setTimeout(() => setJustSaved(false), 2000)
  }, [penNote.id, penNote.strokes, penNote.updatedAt, record])

  // Auto-save a version 2s after the last change (scheduling only — no
  // synchronous setState in the effect body).
  useEffect(() => {
    if (!dirty) return
    const t = window.setTimeout(doSave, 2000)
    return () => window.clearTimeout(t)
  }, [dirty, doSave])

  const handleRestore = (strokes: PenStroke[]) => {
    updateStrokes(penNote.id, strokes)
    setShowHistory(false)
  }

  return (
    <div className="flex h-full flex-col">
      {/* Note-level toolbar (mirrors the notes editor) */}
      <div className="flex h-10 shrink-0 items-center gap-1.5 border-b border-border px-3">
        <input
          value={penNote.title}
          onChange={e => updateTitle(penNote.id, e.target.value)}
          placeholder="Untitled pen note"
          className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-text outline-none placeholder:text-text3"
        />

        <span className={`mr-1 shrink-0 text-xs transition-all ${saveStatus === 'idle' ? 'opacity-0 pointer-events-none' : 'opacity-100'} ${saveStatus === 'saved' ? 'text-green-500' : 'text-text3'}`}>
          {saveStatus === 'saved' ? <span className="flex items-center gap-0.5"><Icon name="check" size={11} /> Saved</span> : saveStatus === 'dirty' ? 'Unsaved' : ''}
        </span>

        <button type="button" onClick={doSave} disabled={!dirty}
          title={dirty ? 'Save a version' : 'No unsaved changes'}
          className={`flex h-7 items-center gap-1 rounded px-2.5 text-xs font-medium transition ${dirty ? 'bg-accent/10 text-accent hover:bg-accent/20' : 'cursor-default text-text3 opacity-40'}`}>
          <Icon name="save" size={12} /> Save
        </button>

        <div className="mx-0.5 h-4 w-px bg-border" />

        <button type="button" title="Version history" onClick={() => setShowHistory(v => !v)}
          className={`flex h-7 w-7 items-center justify-center rounded transition ${showHistory ? 'bg-accent/10 text-accent' : 'text-text3 hover:bg-surface3 hover:text-text'}`}>
          <Icon name="history" size={14} />
        </button>

        <IconButton icon="trash-2" label="Delete pen note" size="sm" onClick={onDelete} className="hover:bg-red-500/10 hover:text-red-400" />

        <div className="mx-0.5 h-4 w-px bg-border" />

        <button type="button" title={sidebarOpen ? 'Hide properties' : 'Show properties'} onClick={() => setSidebarOpen(v => !v)}
          className={`flex h-7 w-7 items-center justify-center rounded transition ${sidebarOpen ? 'bg-accent/10 text-accent' : 'text-text3 hover:bg-surface3 hover:text-text'}`}>
          <Icon name={sidebarOpen ? 'panel-right-close' : 'panel-right-open'} size={14} />
        </button>
      </div>

      {/* Body: canvas + right sidebar + history overlay */}
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <div className="flex min-w-0 flex-1 flex-col">
          <PenCanvas
            strokes={penNote.strokes}
            onChange={s => updateStrokes(penNote.id, s)}
            pageWidth={penNote.pageWidth}
            height={penNote.height}
            onGrow={h => setHeight(penNote.id, h)}
            onSelectionToText={onSelectionToText}
            toTextAvailable={toTextAvailable}
          />
        </div>

        {sidebarOpen && (
          <div className="w-64 shrink-0 border-l border-border">
            <PenNoteRightSidebar penNote={penNote} />
          </div>
        )}

        {showHistory && (
          <PenNoteHistoryPanel penNoteId={penNote.id} onRestore={handleRestore} onClose={() => setShowHistory(false)} />
        )}
      </div>
    </div>
  )
}
