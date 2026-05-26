import { Dropdown } from '../../molecules/Dropdown'
import { ExportMenu } from './EditorExportMenu'
import { Icon } from '../../../icons/Icon'
import type { EditorDraftProps, SaveStatus } from '../../../types'

interface EditorToolbarProps {
  note: EditorDraftProps['note']
  title: string
  onTitleChange: (v: string) => void
  saveStatus: SaveStatus
  onSave: () => void
  exportingPDF: boolean
  onExportPDF: () => void
  showHistory: boolean
  onToggleHistory: () => void
  onReadingMode: () => void
  onDelete: () => void
}

export function EditorToolbar({
  note, title, onTitleChange, saveStatus, onSave,
  exportingPDF, onExportPDF,
  showHistory, onToggleHistory, onReadingMode, onDelete,
}: EditorToolbarProps) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <input
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
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
        onClick={onSave}
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

      <Dropdown trigger={
        <div className="flex h-[38px] shrink-0 items-center gap-1.5 rounded-md border border-border bg-surface px-3 text-sm font-medium text-text3 transition hover:border-accent/50 hover:text-accent">
          <Icon name="share" size={14} />
          <span className="hidden sm:inline">Export</span>
          <Icon name="chevron-down" size={12} />
        </div>
      }>
        <ExportMenu note={note} exportingPDF={exportingPDF} onExportPDF={onExportPDF} size="md" />
      </Dropdown>

      <button
        type="button"
        title="Reading mode"
        onClick={onReadingMode}
        className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-md border border-border bg-surface text-text3 transition hover:border-accent/50 hover:text-accent"
      >
        <Icon name="eye" size={15} />
      </button>

      <button
        type="button"
        title="Version history"
        onClick={onToggleHistory}
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
        onClick={onDelete}
        className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-md border border-border bg-surface text-text3 transition hover:border-red-400/50 hover:text-red-400"
      >
        <Icon name="trash-2" size={15} />
      </button>
    </div>
  )
}
