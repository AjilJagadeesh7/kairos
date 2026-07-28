import { Dropdown } from '../../molecules/Dropdown'
import { SlotRenderer } from '../../molecules/SlotRenderer'
import { ExportMenu } from './EditorExportMenu'
import { Icon } from '../../../icons/Icon'
import { useAppStore } from '../../../store/useAppStore'
import type { EditorDraftProps, SaveStatus } from '../../../types'

interface EditorToolbarProps {
  note: EditorDraftProps['note']
  noteTitle: string
  saveStatus: SaveStatus
  onSave: () => void
  showHistory: boolean
  onToggleHistory: () => void
  onReadingMode: () => void
  onDelete: () => void
  sidebarOpen: boolean
  onToggleSidebar: () => void
}

export function EditorToolbar({
  note, noteTitle, saveStatus, onSave,
  showHistory, onToggleHistory, onReadingMode, onDelete,
  sidebarOpen, onToggleSidebar,
}: EditorToolbarProps) {
  const slotProps = { noteId: note.id, noteTitle }

  // Live sync opt-out state for this note (reflects the stored note, not the draft).
  const setNoteNoSync = useAppStore((s) => s.setNoteNoSync)
  const isSynced      = useAppStore((s) => !s.notes.find((n) => n.id === note.id)?.noSync)

  const editorZoom    = useAppStore((s) => s.editorZoom)
  const setEditorZoom = useAppStore((s) => s.setEditorZoom)
  const zoomPct       = Math.round(editorZoom * 100)

  const overflowItemCls = 'flex w-full items-center gap-2 px-3 py-1.5 text-xs text-text transition hover:bg-surface3'

  const stepBtnCls = 'flex h-7 w-7 items-center justify-center rounded text-base leading-none text-text3 transition hover:bg-surface3 hover:text-text'
  const ZoomStepper = () => (
    <div className="flex items-center gap-0.5">
      <button type="button" title="Zoom out" aria-label="Zoom out"
        onClick={() => setEditorZoom(editorZoom - 0.1)} className={stepBtnCls}>−</button>
      <button type="button" title="Reset zoom" aria-label="Reset zoom"
        onClick={() => setEditorZoom(1)}
        className="min-w-[3.5ch] rounded px-1 text-center text-[11px] font-medium tabular-nums text-text3 transition hover:bg-surface3 hover:text-text">
        {zoomPct}%
      </button>
      <button type="button" title="Zoom in" aria-label="Zoom in"
        onClick={() => setEditorZoom(editorZoom + 0.1)} className={stepBtnCls}>+</button>
    </div>
  )

  return (
    <div className="touch-compact flex h-10 shrink-0 items-center gap-1.5 border-b border-border px-2 md:px-3">

      <SlotRenderer slot="editor:toolbar:start" props={slotProps} className="flex items-center" />

      {/* Save status — hidden on mobile to save horizontal room */}
      <span className={`mr-1 hidden shrink-0 text-xs transition-all md:inline ${
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
        onClick={onSave}
        disabled={saveStatus === 'saving' || saveStatus === 'idle'}
        title={saveStatus === 'dirty' ? 'Save (⌘S)' : 'No unsaved changes'}
        className={`flex h-7 items-center gap-1 rounded px-2.5 text-xs font-medium transition ${
          saveStatus === 'dirty'
            ? 'bg-accent/10 text-accent hover:bg-accent/20'
            : 'cursor-default text-text3 opacity-40'
        }`}
      >
        <Icon name="save" size={12} />
        <span className="hidden md:inline">Save</span>
      </button>

      {/* ── Actions: full inline set on desktop ─────────────────────── */}
      <div className="hidden items-center gap-1.5 md:flex">
        {/* Export */}
        <Dropdown trigger={
          <div className="flex h-7 items-center gap-1 rounded px-2.5 text-xs font-medium text-text3 transition hover:bg-surface3 hover:text-text">
            <Icon name="share" size={12} />
            Export
            <Icon name="chevron-down" size={10} />
          </div>
        }>
          <ExportMenu note={note} size="md" />
        </Dropdown>

        <div className="mx-0.5 h-4 w-px bg-border" />

        {/* Zoom */}
        <ZoomStepper />

        <div className="mx-0.5 h-4 w-px bg-border" />

        {/* Reading mode */}
        <button type="button" title="Reading mode" onClick={onReadingMode}
          className="flex h-7 w-7 items-center justify-center rounded text-text3 transition hover:bg-surface3 hover:text-text"
        >
          <Icon name="eye" size={14} />
        </button>

        {/* History */}
        <button type="button" title="Version history" onClick={onToggleHistory}
          className={`flex h-7 w-7 items-center justify-center rounded transition ${
            showHistory ? 'bg-accent/10 text-accent' : 'text-text3 hover:bg-surface3 hover:text-text'
          }`}
        >
          <Icon name="history" size={14} />
        </button>

        {/* Sync this note (opt out keeps it local-only) */}
        <button type="button"
          title={isSynced ? "Don't sync this note — keep it local-only" : 'Sync this note'}
          aria-pressed={!isSynced}
          onClick={() => void setNoteNoSync(note.id, isSynced)}
          className={`flex h-7 w-7 items-center justify-center rounded transition ${
            isSynced ? 'text-text3 hover:bg-surface3 hover:text-text' : 'bg-accent/10 text-accent'
          }`}
        >
          <Icon name={isSynced ? 'cloud' : 'cloud-off'} size={14} />
        </button>

        {/* Delete */}
        <button type="button" title="Delete note" onClick={onDelete}
          className="flex h-7 w-7 items-center justify-center rounded text-text3 transition hover:bg-red-500/10 hover:text-red-400"
        >
          <Icon name="trash-2" size={14} />
        </button>
      </div>

      {/* ── Mobile: reading inline + overflow (⋯) menu ───────────────── */}
      <div className="flex items-center gap-1.5 md:hidden">
        <button type="button" title="Reading mode" onClick={onReadingMode}
          className="flex h-7 w-7 items-center justify-center rounded text-text3 transition hover:bg-surface3 hover:text-text"
        >
          <Icon name="eye" size={14} />
        </button>

        <Dropdown trigger={
          <div className="flex h-7 w-7 items-center justify-center rounded text-text3 transition hover:bg-surface3 hover:text-text">
            <Icon name="more-horizontal" size={16} />
          </div>
        }>
          <div className="w-44 py-1">
            <div className="flex items-center justify-between px-3 pb-1.5 pt-0.5">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-text3">Zoom</span>
              <ZoomStepper />
            </div>
            <div className="my-1 h-px bg-border" />
            <div className="px-3 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-wide text-text3">Export</div>
            <ExportMenu note={note} size="md" />
            <div className="my-1 h-px bg-border" />
            <button type="button" onClick={onToggleHistory} className={overflowItemCls}>
              <Icon name="history" size={14} /> Version history
            </button>
            <button type="button" onClick={() => void setNoteNoSync(note.id, isSynced)} className={overflowItemCls}>
              <Icon name={isSynced ? 'cloud' : 'cloud-off'} size={14} /> {isSynced ? "Don't sync" : 'Enable sync'}
            </button>
            <button type="button" onClick={onDelete} className={`${overflowItemCls} hover:text-red-400`}>
              <Icon name="trash-2" size={14} /> Delete note
            </button>
          </div>
        </Dropdown>
      </div>

      <SlotRenderer slot="editor:toolbar:end" props={slotProps} className="flex items-center" />

      <div className="mx-0.5 h-4 w-px bg-border" />

      {/* Sidebar toggle */}
      <button type="button" title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'} onClick={onToggleSidebar}
        className={`flex h-7 w-7 items-center justify-center rounded transition ${
          sidebarOpen ? 'bg-accent/10 text-accent' : 'text-text3 hover:bg-surface3 hover:text-text'
        }`}
      >
        <Icon name={sidebarOpen ? 'panel-right-close' : 'panel-right-open'} size={14} />
      </button>
    </div>
  )
}
