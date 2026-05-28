import { useEffect } from 'react'
import {
  SortableContext, useSortable, horizontalListSortingStrategy,
} from '@dnd-kit/sortable'
import { useDroppable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { usePaneStore, pathToType, type PaneTab } from '../../../store/usePaneStore'
import { useAppStore } from '../../../store/useAppStore'
import { Icon } from '../../../icons/Icon'

// ── Helpers ────────────────────────────────────────────────────────────────────

export function deriveTitle(path: string, notes: { id: string; title: string }[]): string {
  if (path === '/' || path === '') return 'Home'
  if (path.startsWith('/notes/')) {
    const id   = path.slice('/notes/'.length)
    const note = notes.find(n => n.id === id)
    return note?.title || 'Note'
  }
  if (path === '/notes')              return 'Notes'
  if (path.startsWith('/journal/'))   return path.slice('/journal/'.length)
  if (path === '/journal')            return 'Journal'
  if (path.startsWith('/kanban/'))    return 'Kanban Board'
  if (path === '/kanban')             return 'Kanban'
  if (path === '/graph')              return 'Graph'
  if (path === '/settings')           return 'Settings'
  return 'Page'
}

function tabIcon(type: PaneTab['type'], size = 13) {
  switch (type) {
    case 'notes':    return <Icon name="book-open"    size={size} />
    case 'journal':  return <Icon name="calendar-days" size={size} />
    case 'kanban':   return <Icon name="square-kanban" size={size} />
    case 'graph':    return <Icon name="network"      size={size} />
    case 'settings': return <Icon name="settings-2"    size={size} />
    default:         return <Icon name="home"       size={size} />
  }
}

// ── Sortable tab item ──────────────────────────────────────────────────────────

interface SortableTabProps {
  paneId:         string
  tab:            PaneTab
  isActive:       boolean
  isFocusedPane:  boolean
  title:          string
  isDragging:     boolean
  onClose:        (e: React.MouseEvent) => void
  onClick:        () => void
}

function SortableTab({ paneId, tab, isActive, title, isDragging: _outer, onClose, onClick, isFocusedPane }: SortableTabProps) {
  const {
    attributes, listeners, setNodeRef,
    transform, transition, isDragging,
  } = useSortable({
    id: `${paneId}:${tab.id}`,
    data: { paneId, tabId: tab.id },
  })

  return (
    <div
      ref={setNodeRef}
      data-active={isActive}
      style={{ transform: CSS.Transform.toString(transform), transition, height: 34, maxWidth: 200 }}
      className={`group relative flex shrink-0 items-center border-r border-[rgb(var(--border))] text-[12px] select-none transition-colors
        ${isDragging ? 'opacity-40' : ''}
        ${isActive
          ? 'bg-bg text-text'
          : 'bg-surface text-text3 hover:bg-surface2 hover:text-text2'
        }`}
    >
      {isActive && (
        <span className={`pointer-events-none absolute inset-x-0 top-0 h-[3px] rounded-b-full ${isFocusedPane ? 'bg-accent' : 'bg-accent/40'}`} />
      )}
      <button
        {...listeners}
        {...attributes}
        onClick={onClick}
        className="flex min-w-0 flex-1 items-center gap-1.5 px-2.5 h-full cursor-grab active:cursor-grabbing"
        style={{ maxWidth: 155 }}
      >
        <span className={`shrink-0 ${isActive ? 'text-accent' : ''}`}>
          {tabIcon(pathToType(tab.path))}
        </span>
        <span className="min-w-0 flex-1 truncate text-left">{title}</span>
      </button>
      <button
        aria-label="Close tab"
        onClick={onClose}
        className="mr-1 flex h-4 w-4 shrink-0 items-center justify-center rounded opacity-0 transition-all group-hover:opacity-100 hover:bg-surface3 hover:text-text"
      >
        <Icon name="x" size={10} />
      </button>
    </div>
  )
}

// ── Drop zone: drop a tab here to move it to this pane ────────────────────────

function PaneDropZone({ paneId, visible, isOver }: { paneId: string; visible: boolean; isOver: boolean }) {
  const { setNodeRef } = useDroppable({ id: `pane-drop:${paneId}`, data: { paneId, type: 'pane' } })
  if (!visible) return <div ref={setNodeRef} />  // still register droppable
  return (
    <div
      ref={setNodeRef}
      className={`flex shrink-0 items-center justify-center self-center mx-1 rounded border px-2 text-[11px] font-medium transition-all
        ${isOver
          ? 'border-accent bg-accent/15 text-accent'
          : 'border-dashed border-[rgb(var(--border))] bg-surface2 text-text3'
        }`}
      style={{ height: 24 }}
    >
      Move here
    </div>
  )
}

// ── PaneTabBar ─────────────────────────────────────────────────────────────────

interface PaneTabBarProps {
  paneId:          string
  draggingTabId:   string | null  // global drag state from PaneLayout
  overDropTarget:  string | null  // which drop target is currently hovered
}

export function PaneTabBar({ paneId, draggingTabId, overDropTarget }: PaneTabBarProps) {
  const pane          = usePaneStore(s => s.panes.find(p => p.id === paneId))
  const paneCount     = usePaneStore(s => s.panes.length)
  const focusedPaneId = usePaneStore(s => s.focusedPaneId)
  const notes         = useAppStore(s => s.notes)
  const newTabPage    = useAppStore(s => s.newTabPage)

  const {
    setActiveTab, closeTab, openInNewTab,
    addPane, removePane, updateActiveTab,
  } = usePaneStore()

  // Sync active tab title when notes load or path changes
  useEffect(() => {
    if (!pane) return
    const activeTab = pane.tabs.find(t => t.id === pane.activeTabId)
    if (!activeTab) return
    const title = deriveTitle(activeTab.path, notes)
    if (title !== activeTab.title) {
      updateActiveTab(paneId, activeTab.path, title)
    }
  }, [pane?.activeTabId, notes]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!pane) return null

  const isFocused = focusedPaneId === paneId
  const isDraggingFromThisPane = draggingTabId != null &&
    draggingTabId.startsWith(`${paneId}:`)
  const isOverThisPane = overDropTarget === `pane-drop:${paneId}`

  function handleNewTab() {
    const path  = newTabPage || '/'
    const title = deriveTitle(path, notes)
    openInNewTab(paneId, path, title)
  }

  function handleSplit() {
    const activeTab = pane!.tabs.find(t => t.id === pane!.activeTabId)
    const path  = activeTab?.path ?? '/notes'
    const title = deriveTitle(path, notes)
    addPane(paneId, path, title)
  }

  const tabIds = pane.tabs.map(t => `${paneId}:${t.id}`)

  return (
    <div className={`hidden md:flex min-h-0 shrink-0 items-stretch ${
      isFocused
        ? 'bg-bg border-b-2 border-b-[rgb(var(--accent))]'
        : 'bg-surface border-b border-[rgb(var(--border))]'
    }`}>
      <SortableContext items={tabIds} strategy={horizontalListSortingStrategy}>
        <div
          className="flex min-w-0 flex-1 items-stretch overflow-x-auto"
          style={{ scrollbarWidth: 'none' }}
        >
          {pane.tabs.map(tab => {
            const isActive = tab.id === pane.activeTabId
            const title    = deriveTitle(tab.path, notes)
            return (
              <SortableTab
                key={tab.id}
                paneId={paneId}
                tab={tab}
                isActive={isActive}
                isFocusedPane={isFocused}
                title={title}
                isDragging={draggingTabId === `${paneId}:${tab.id}`}
                onClick={() => setActiveTab(paneId, tab.id)}
                onClose={(e) => { e.stopPropagation(); closeTab(paneId, tab.id) }}
              />
            )
          })}

          {/* New tab button */}
          <button
            onClick={handleNewTab}
            className="flex shrink-0 items-center self-center mx-1 h-5 w-5 justify-center rounded text-text3 transition-colors hover:bg-surface2 hover:text-text2"
            aria-label="New tab"
          >
            <Icon name="plus" size={13} />
          </button>

          {/* Drop zone for receiving tabs from other panes — visible while dragging from elsewhere */}
          <PaneDropZone
            paneId={paneId}
            visible={draggingTabId != null && !isDraggingFromThisPane}
            isOver={isOverThisPane}
          />
        </div>
      </SortableContext>

      {/* Pane actions: split + close */}
      <div className="flex shrink-0 items-stretch border-l border-[rgb(var(--border))]">
        <button
          onClick={handleSplit}
          className="flex items-center justify-center px-2 text-text3 transition-colors hover:bg-surface2 hover:text-text2"
          title="Split pane"
        >
          <Icon name="columns-2" size={13} />
        </button>
        {paneCount > 1 && (
          <button
            onClick={() => removePane(paneId)}
            className="flex items-center justify-center px-1.5 text-text3 transition-colors hover:bg-surface2 hover:text-text2"
            title="Close pane"
          >
            <Icon name="x" size={13} />
          </button>
        )}
      </div>
    </div>
  )
}
