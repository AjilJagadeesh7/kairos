import { useState, useRef, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  DndContext, DragOverlay,
  PointerSensor, useSensor, useSensors,
  closestCenter,
  type DragStartEvent, type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, useSortable, arrayMove,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  BookOpen, CalendarDays, SquareKanban, Network, Settings2,
  Home, Plus, X, Columns2,
} from 'lucide-react'
import { useTabStore, pathToType, type Tab } from '../../../store/useTabStore'
import { useAppStore } from '../../../store/useAppStore'
import { useSplitStore } from '../../../store/useSplitStore'

function tabIcon(type: Tab['type'], size = 13) {
  switch (type) {
    case 'notes':    return <BookOpen    size={size} />
    case 'journal':  return <CalendarDays size={size} />
    case 'kanban':   return <SquareKanban size={size} />
    case 'graph':    return <Network      size={size} />
    case 'settings': return <Settings2    size={size} />
    default:         return <Home         size={size} />
  }
}

function deriveTitle(path: string, notes: { id: string; title: string }[]): string {
  if (path === '/' || path === '') return 'Home'
  if (path.startsWith('/notes/')) {
    const id = path.slice('/notes/'.length)
    const note = notes.find(n => n.id === id)
    return note?.title || 'Note'
  }
  if (path === '/notes')    return 'Notes'
  if (path.startsWith('/journal/')) return path.slice('/journal/'.length)
  if (path === '/journal')  return 'Journal'
  if (path.startsWith('/kanban/')) return 'Kanban Board'
  if (path === '/kanban')   return 'Kanban'
  if (path === '/graph')    return 'Graph'
  if (path === '/settings') return 'Settings'
  return 'Page'
}

// ── Sortable tab item ─────────────────────────────────────────────────────────

interface SortableTabItemProps {
  tab: Tab
  isActive: boolean
  title: string
  onTabClick: (tab: Tab) => void
  onClose: (e: React.MouseEvent, id: string) => void
}

function SortableTabItem({ tab, isActive, title, onTabClick, onClose }: SortableTabItemProps) {
  const {
    attributes, listeners, setNodeRef,
    transform, transition, isDragging,
  } = useSortable({ id: tab.id })

  return (
    <div
      ref={setNodeRef}
      data-active={isActive}
      style={{ transform: CSS.Transform.toString(transform), transition, height: 36, maxWidth: 200 }}
      className={`group relative flex shrink-0 items-center border-r border-[rgb(var(--border))] text-[12px] select-none transition-colors
        ${isDragging ? 'opacity-40' : ''}
        ${isActive
          ? 'bg-bg text-text'
          : 'bg-surface text-text3 hover:bg-surface2 hover:text-text2'
        }`}
    >
      {isActive && (
        <span className="pointer-events-none absolute inset-x-0 top-0 h-[2px] rounded-b-full bg-accent" />
      )}

      {/* Main clickable + draggable area */}
      <button
        {...listeners}
        {...attributes}
        onClick={() => onTabClick(tab)}
        className="flex min-w-0 flex-1 items-center gap-1.5 px-3 h-full cursor-grab active:cursor-grabbing"
        style={{ maxWidth: 160 }}
      >
        <span className={`shrink-0 ${isActive ? 'text-accent' : ''}`}>
          {tabIcon(pathToType(tab.path))}
        </span>
        <span className="min-w-0 flex-1 truncate text-left">{title}</span>
      </button>

      {/* Close button — not part of drag */}
      <button
        aria-label="Close tab"
        onClick={(e) => onClose(e, tab.id)}
        className="mr-1.5 flex h-4 w-4 shrink-0 items-center justify-center rounded opacity-0 transition-all group-hover:opacity-100 hover:bg-surface3 hover:text-text"
      >
        <X size={10} />
      </button>
    </div>
  )
}

// ── Tab drag overlay (floating preview while dragging) ─────────────────────────

function TabDragPreview({ tab, title, isActive }: { tab: Tab; title: string; isActive: boolean }) {
  return (
    <div
      className={`flex shrink-0 items-center rounded border border-[rgb(var(--border))] text-[12px] shadow-xl select-none
        ${isActive ? 'bg-bg text-text' : 'bg-surface text-text'}`}
      style={{ height: 36, maxWidth: 200 }}
    >
      <div className="flex min-w-0 flex-1 items-center gap-1.5 px-3 h-full" style={{ maxWidth: 160 }}>
        <span className={`shrink-0 ${isActive ? 'text-accent' : ''}`}>
          {tabIcon(pathToType(tab.path))}
        </span>
        <span className="min-w-0 flex-1 truncate text-left">{title}</span>
      </div>
      <div className="mr-1.5 h-4 w-4 shrink-0" />
    </div>
  )
}

// ── TabBar ────────────────────────────────────────────────────────────────────

export function TabBar() {
  const navigate      = useNavigate()
  const location      = useLocation()
  const {
    tabs, activeId, openInNewTab, closeTab,
    setActiveTab, updateActiveTab, reorderTabs,
  }                   = useTabStore()
  const notes         = useAppStore(s => s.notes)
  const newTabPage    = useAppStore(s => s.newTabPage)
  const isSplit       = useSplitStore(s => s.isSplit)
  const enableSplit   = useSplitStore(s => s.enableSplit)
  const disableSplit  = useSplitStore(s => s.disableSplit)
  const navigateRight = useSplitStore(s => s.navigateRight)
  const scrollRef     = useRef<HTMLDivElement>(null)

  const [dragTabId, setDragTabId] = useState<string | null>(null)
  const [isOverSplitZone, setIsOverSplitZone] = useState(false)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  )

  // Sync location changes → update active tab's stored path + title
  useEffect(() => {
    const path  = location.pathname
    const title = deriveTitle(path, notes)
    updateActiveTab(path, title)
  }, [location.pathname, notes]) // eslint-disable-line react-hooks/exhaustive-deps

  function handleTabClick(tab: Tab) {
    setActiveTab(tab.id)
    navigate(tab.path)
  }

  function handleClose(e: React.MouseEvent, id: string) {
    e.stopPropagation()
    const wasActive = useTabStore.getState().activeId === id
    closeTab(id)
    if (wasActive) {
      const { activeId: newActiveId, tabs: newTabs } = useTabStore.getState()
      const newTab = newTabs.find(t => t.id === newActiveId)
      if (newTab) navigate(newTab.path)
    }
  }

  function handleNewTab() {
    const path  = newTabPage || '/'
    const title = deriveTitle(path, notes)
    useTabStore.setState(s => {
      const tab = { id: crypto.randomUUID(), path, title, type: pathToType(path) }
      return { tabs: [...s.tabs, tab], activeId: tab.id }
    })
    navigate(path)
  }

  function handleDragStart({ active }: DragStartEvent) {
    setDragTabId(String(active.id))
  }

  function handleDragMove({ over }: { over: { id: string | number } | null }) {
    setIsOverSplitZone(over?.id === 'split-drop')
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setDragTabId(null)
    setIsOverSplitZone(false)
    if (!over) return

    const activeTab = tabs.find(t => t.id === String(active.id))
    if (!activeTab) return

    if (String(over.id) === 'split-drop') {
      if (isSplit) {
        navigateRight(activeTab.path)
      } else {
        enableSplit(activeTab.path)
      }
      return
    }

    if (active.id !== over.id) {
      const oldIdx = tabs.findIndex(t => t.id === String(active.id))
      const newIdx = tabs.findIndex(t => t.id === String(over.id))
      if (oldIdx !== -1 && newIdx !== -1) {
        reorderTabs(arrayMove(tabs, oldIdx, newIdx).map(t => t.id))
      }
    }
  }

  // Ctrl/Cmd+click on nav items fires mv:open-tab events
  useEffect(() => {
    const handler = (e: Event) => {
      const { path, title } = (e as CustomEvent<{ path: string; title: string }>).detail
      openInNewTab(path, title || deriveTitle(path, notes))
      navigate(path)
    }
    window.addEventListener('mv:open-tab', handler)
    return () => window.removeEventListener('mv:open-tab', handler)
  }, [navigate, notes, openInNewTab]) // eslint-disable-line react-hooks/exhaustive-deps

  // Scroll active tab into view
  useEffect(() => {
    const el = scrollRef.current?.querySelector('[data-active="true"]') as HTMLElement | null
    el?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' })
  }, [activeId])

  const dragTab = dragTabId ? tabs.find(t => t.id === dragTabId) : null

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      onDragEnd={handleDragEnd}
    >
      <div className="flex min-h-0 shrink-0 items-stretch border-b border-[rgb(var(--border))] bg-[rgb(var(--surface))]">
        <SortableContext items={tabs.map(t => t.id)} strategy={horizontalListSortingStrategy}>
          <div
            ref={scrollRef}
            className="flex min-w-0 flex-1 items-stretch overflow-x-auto"
            style={{ scrollbarWidth: 'none' }}
          >
            {tabs.map(tab => {
              const isActive = tab.id === activeId
              const title = isActive
                ? deriveTitle(location.pathname, notes)
                : deriveTitle(tab.path, notes)

              return (
                <SortableTabItem
                  key={tab.id}
                  tab={tab}
                  isActive={isActive}
                  title={title}
                  onTabClick={handleTabClick}
                  onClose={handleClose}
                />
              )
            })}

            {/* New tab button — sits immediately after the last tab */}
            <button
              onClick={handleNewTab}
              className="flex shrink-0 items-center self-center mx-1 h-6 w-6 justify-center rounded text-text3 transition-colors hover:bg-surface2 hover:text-text2"
              aria-label="New tab"
              title="New tab"
            >
              <Plus size={14} />
            </button>

            {/* Split drop zone — appears when dragging a tab */}
            {dragTabId && (
              <SplitDropZone isOver={isOverSplitZone} isSplit={isSplit} />
            )}
          </div>
        </SortableContext>

        {/* Split toggle — pinned to the right edge */}
        <button
          onClick={() => isSplit ? disableSplit() : enableSplit(location.pathname)}
          className={`flex shrink-0 items-center justify-center px-2.5 border-l border-[rgb(var(--border))] transition-colors
            ${isSplit
              ? 'text-accent hover:bg-surface2'
              : 'text-text3 hover:bg-surface2 hover:text-text2'
            }`}
          aria-label={isSplit ? 'Close split view' : 'Open split view'}
          title={isSplit ? 'Close split view' : 'Split view'}
        >
          <Columns2 size={14} />
        </button>
      </div>

      {/* Floating drag preview */}
      <DragOverlay dropAnimation={null}>
        {dragTab && (
          <TabDragPreview
            tab={dragTab}
            title={deriveTitle(dragTab.path, notes)}
            isActive={dragTab.id === activeId}
          />
        )}
      </DragOverlay>
    </DndContext>
  )
}

// ── Split drop zone (droppable target) ────────────────────────────────────────

import { useDroppable } from '@dnd-kit/core'

function SplitDropZone({ isOver, isSplit }: { isOver: boolean; isSplit: boolean }) {
  const { setNodeRef } = useDroppable({ id: 'split-drop' })

  return (
    <div
      ref={setNodeRef}
      className={`flex shrink-0 items-center justify-center gap-1 self-center mx-1 rounded border px-2.5 text-[11px] font-medium transition-all
        ${isOver
          ? 'border-accent bg-accent/15 text-accent'
          : 'border-dashed border-[rgb(var(--border))] bg-surface2 text-text3'
        }`}
      style={{ height: 26 }}
    >
      <Columns2 size={11} />
      {isSplit ? 'Open here' : 'Split'}
    </div>
  )
}
