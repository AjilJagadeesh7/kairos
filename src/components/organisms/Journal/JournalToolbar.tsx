import { SlotRenderer } from '../../molecules/SlotRenderer'
import { Dropdown } from '../../molecules/Dropdown'
import { JournalExportMenu } from './JournalExportMenu'
import { Icon } from '../../../icons/Icon'

type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved'

interface JournalToolbarProps {
  date: string
  label: string
  shortLabel: string
  isToday: boolean
  content: string
  editorRootRef: React.RefObject<HTMLDivElement>
  saveStatus: SaveStatus
  readingMode: boolean
  showHistory: boolean
  sidebarOpen: boolean
  entryExists: boolean
  entryNoSync: boolean
  onPrev: () => void
  onNext: () => void
  onSave: () => void
  onToggleReading: () => void
  onToggleHistory: () => void
  onToggleSync: () => void
  onDelete: () => void
  onToggleSidebar: () => void
}

const overflowItemCls = 'flex w-full items-center gap-2 px-3 py-1.5 text-xs text-text transition hover:bg-surface3'

export function JournalToolbar({
  date, label, shortLabel, isToday, content, editorRootRef,
  saveStatus, readingMode, showHistory, sidebarOpen,
  entryExists, entryNoSync,
  onPrev, onNext, onSave, onToggleReading, onToggleHistory, onToggleSync, onDelete, onToggleSidebar,
}: JournalToolbarProps) {
  return (
    <div className="touch-compact flex h-10 shrink-0 items-center gap-1.5 border-b border-border px-2 md:px-3">
      {/* Day navigation + date — one shrinkable group so the date truncates instead of overflowing */}
      <div className="flex min-w-0 flex-1 items-center gap-1.5 md:flex-none">
        <button type="button" title="Previous day" onClick={onPrev}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-text3 transition hover:bg-surface3 hover:text-text"
        >
          <Icon name="chevron-left" size={14} />
        </button>

        <div className="flex min-w-0 items-baseline">
          <span className="truncate text-sm font-semibold text-text">
            <span className="md:hidden">{shortLabel}</span>
            <span className="hidden md:inline">{label}</span>
          </span>
          {isToday && <span className="ml-2 shrink-0 text-[11px] font-medium text-accent">Today</span>}
        </div>

        <button type="button" title="Next day" onClick={onNext}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-text3 transition hover:bg-surface3 hover:text-text"
        >
          <Icon name="chevron-right" size={14} />
        </button>
      </div>

      <SlotRenderer slot="journal:header:end" props={{ date }} className="flex items-center" />

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
      <button type="button" onClick={onSave}
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

      {/* Export */}
      <JournalExportMenu title={label} markdown={content} editorRootRef={editorRootRef} />

      <div className="mx-0.5 h-4 w-px bg-border" />

      {/* Reading mode */}
      <button type="button" title="Reading mode" onClick={onToggleReading}
        className={`flex h-7 w-7 items-center justify-center rounded transition ${
          readingMode ? 'bg-accent/10 text-accent' : 'text-text3 hover:bg-surface3 hover:text-text'
        }`}
      >
        <Icon name="eye" size={14} />
      </button>

      {/* History / sync / delete — inline on desktop */}
      <div className="hidden items-center gap-1.5 md:flex">
        <button type="button" title="Version history" onClick={onToggleHistory}
          className={`flex h-7 w-7 items-center justify-center rounded transition ${
            showHistory ? 'bg-accent/10 text-accent' : 'text-text3 hover:bg-surface3 hover:text-text'
          }`}
        >
          <Icon name="history" size={14} />
        </button>

        {entryExists && (
          <button type="button"
            title={entryNoSync ? 'Sync this entry' : "Don't sync this entry — keep it local-only"}
            aria-pressed={entryNoSync}
            onClick={onToggleSync}
            className={`flex h-7 w-7 items-center justify-center rounded transition ${
              entryNoSync ? 'bg-accent/10 text-accent' : 'text-text3 hover:bg-surface3 hover:text-text'
            }`}
          >
            <Icon name={entryNoSync ? 'cloud-off' : 'cloud'} size={14} />
          </button>
        )}

        {entryExists && (
          <button type="button" title="Delete this entry" onClick={onDelete}
            className="flex h-7 w-7 items-center justify-center rounded text-text3 transition hover:bg-red-500/10 hover:text-red-400"
          >
            <Icon name="trash-2" size={14} />
          </button>
        )}
      </div>

      {/* Mobile: overflow (⋯) menu */}
      <div className="md:hidden">
        <Dropdown trigger={
          <div className="flex h-7 w-7 items-center justify-center rounded text-text3 transition hover:bg-surface3 hover:text-text">
            <Icon name="more-horizontal" size={16} />
          </div>
        }>
          <div className="w-44 py-1">
            <button type="button" onClick={onToggleHistory} className={overflowItemCls}>
              <Icon name="history" size={14} /> Version history
            </button>
            {entryExists && (
              <button type="button" onClick={onToggleSync} className={overflowItemCls}>
                <Icon name={entryNoSync ? 'cloud-off' : 'cloud'} size={14} /> {entryNoSync ? 'Enable sync' : "Don't sync"}
              </button>
            )}
            {entryExists && (
              <button type="button" onClick={onDelete} className={`${overflowItemCls} hover:text-red-400`}>
                <Icon name="trash-2" size={14} /> Delete entry
              </button>
            )}
          </div>
        </Dropdown>
      </div>

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
