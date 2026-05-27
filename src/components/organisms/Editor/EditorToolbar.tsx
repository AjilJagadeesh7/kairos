import { Dropdown } from '../../molecules/Dropdown'
import { SlotRenderer } from '../../molecules/SlotRenderer'
import { ExportMenu } from './EditorExportMenu'
import { Icon } from '../../../icons/Icon'
import type { EditorDraftProps, SaveStatus } from '../../../types'

interface EditorToolbarProps {
  note: EditorDraftProps['note']
  noteTitle: string
  saveStatus: SaveStatus
  onSave: () => void
  exportingPDF: boolean
  onExportPDF: () => void
  showHistory: boolean
  onToggleHistory: () => void
  onReadingMode: () => void
  onDelete: () => void
  sidebarOpen: boolean
  onToggleSidebar: () => void
}

export function EditorToolbar({
  note, noteTitle, saveStatus, onSave,
  exportingPDF, onExportPDF,
  showHistory, onToggleHistory, onReadingMode, onDelete,
  sidebarOpen, onToggleSidebar,
}: EditorToolbarProps) {
  const slotProps = { noteId: note.id, noteTitle }

  return (
    <div className="flex h-10 shrink-0 items-center gap-1.5 border-b border-border px-3">

      <SlotRenderer slot="editor:toolbar:start" props={slotProps} className="flex items-center" />

      {/* Save status */}
      <span className={`mr-1 shrink-0 text-xs transition-all ${
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
        Save
      </button>

      {/* Export */}
      <Dropdown trigger={
        <div className="flex h-7 items-center gap-1 rounded px-2.5 text-xs font-medium text-text3 transition hover:bg-surface3 hover:text-text">
          <Icon name="share" size={12} />
          Export
          <Icon name="chevron-down" size={10} />
        </div>
      }>
        <ExportMenu note={note} exportingPDF={exportingPDF} onExportPDF={onExportPDF} size="md" />
      </Dropdown>

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

      {/* Delete */}
      <button type="button" title="Delete note" onClick={onDelete}
        className="flex h-7 w-7 items-center justify-center rounded text-text3 transition hover:bg-red-500/10 hover:text-red-400"
      >
        <Icon name="trash-2" size={14} />
      </button>

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
