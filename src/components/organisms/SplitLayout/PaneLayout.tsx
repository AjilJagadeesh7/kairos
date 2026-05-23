import { useState, useRef } from 'react'
import { useIsMobile } from '../../../hooks/useIsMobile'
import {
  DndContext, DragOverlay, PointerSensor,
  useSensor, useSensors, closestCenter,
  type DragStartEvent, type DragEndEvent, type DragOverEvent,
} from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import { usePaneStore, type PaneTab } from '../../../store/usePaneStore'
import { useAppStore } from '../../../store/useAppStore'
import { useSidebarResize } from '../../../hooks/useSidebarResize'
import { PaneIdContext, SidebarSlotContext } from '../../../contexts/PaneContext'
import { PaneTabBar, deriveTitle } from '../TabBar/PaneTabBar'
import { CustomNavProvider } from './CustomNavProvider'
import { AppRoutes } from '../../../routes'
import { ErrorBoundary } from '../../common/ErrorBoundary'
import { pathToType } from '../../../store/usePaneStore'
import { Icon } from '../../../icons/Icon'

// ── Tiny drag overlay ──────────────────────────────────────────────────────────

function tabIcon(type: PaneTab['type'], size = 13) {
  switch (type) {
    case 'notes':    return <Icon name="book-open"    size={size} />
    case 'journal':  return <Icon name="calendar-days" size={size} />
    case 'kanban':   return <Icon name="square-kanban" size={size} />
    case 'graph':    return <Icon name="network"      size={size} />
    case 'settings': return <Icon name="settings-2"    size={size} />
    default:         return <Icon name="home"        size={size} />
  }
}

function TabPreview({ tab, isActive, title }: { tab: PaneTab; isActive: boolean; title: string }) {
  return (
    <div
      className={`flex items-center gap-1.5 rounded border border-[rgb(var(--border))] px-2.5 shadow-xl text-[12px] select-none
        ${isActive ? 'bg-bg text-text' : 'bg-surface text-text'}`}
      style={{ height: 34, maxWidth: 200 }}
    >
      <span className={isActive ? 'text-accent' : ''}>{tabIcon(pathToType(tab.path))}</span>
      <span className="min-w-0 truncate">{title}</span>
    </div>
  )
}

// ── PaneLayout ─────────────────────────────────────────────────────────────────

export function PaneLayout() {
  const panes         = usePaneStore(s => s.panes)
  const focusedPaneId = usePaneStore(s => s.focusedPaneId)
  const setFocusedPane = usePaneStore(s => s.setFocusedPane)
  const { reorderTabs, moveTabToPane } = usePaneStore()
  const notes         = useAppStore(s => s.notes)

  const [sidebarSlot, setSidebarSlot] = useState<HTMLDivElement | null>(null)
  const [draggingId, setDraggingId]   = useState<string | null>(null)
  const [overTarget, setOverTarget]   = useState<string | null>(null)
  const slotContainerRef              = useRef<HTMLDivElement>(null)

  const isMobile     = useIsMobile()
  const isMultiPane  = panes.length > 1 && !isMobile
  const sidebarOpen  = useAppStore(s => s.sidebarOpen)
  const sidebarWidth = useAppStore(s => s.sidebarWidth)
  const { startResize } = useSidebarResize(slotContainerRef)

  const SIDEBAR_TYPES = new Set(['notes', 'journal', 'graph', 'settings'])
  const focusedPane      = panes.find(p => p.id === focusedPaneId)
  const focusedActiveTab = focusedPane?.tabs.find(t => t.id === focusedPane.activeTabId)
  const focusedHasSidebar = focusedActiveTab ? SIDEBAR_TYPES.has(focusedActiveTab.type) : false
  const showSlot = isMultiPane && focusedHasSidebar && sidebarOpen

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  )

  function onDragStart({ active }: DragStartEvent) {
    setDraggingId(String(active.id))
  }

  function onDragOver({ over }: DragOverEvent) {
    setOverTarget(over ? String(over.id) : null)
  }

  function onDragEnd({ active, over }: DragEndEvent) {
    setDraggingId(null)
    setOverTarget(null)
    if (!over) return

    const activeId  = String(active.id)
    const overId    = String(over.id)

    // Compound IDs: "paneId:tabId" for tabs, "pane-drop:paneId" for pane drop zones
    const [activePaneId, activeTabId] = activeId.split(':')

    if (overId.startsWith('pane-drop:')) {
      // Move tab to a different pane
      const targetPaneId = overId.slice('pane-drop:'.length)
      if (targetPaneId !== activePaneId) {
        moveTabToPane(activePaneId, activeTabId, targetPaneId)
      }
      return
    }

    // Dropped on another tab
    const [overPaneId, overTabId] = overId.split(':')

    if (activePaneId === overPaneId) {
      // Same pane → reorder
      const pane = panes.find(p => p.id === activePaneId)
      if (!pane || activeTabId === overTabId) return
      const oldIdx  = pane.tabs.findIndex(t => t.id === activeTabId)
      const newIdx  = pane.tabs.findIndex(t => t.id === overTabId)
      if (oldIdx !== -1 && newIdx !== -1) {
        reorderTabs(activePaneId, arrayMove(pane.tabs, oldIdx, newIdx).map(t => t.id))
      }
    } else {
      // Different pane → move tab there
      moveTabToPane(activePaneId, activeTabId, overPaneId)
    }
  }

  // Find dragged tab for the overlay
  const draggedTab = (() => {
    if (!draggingId) return null
    const [paneId, tabId] = draggingId.split(':')
    const pane = panes.find(p => p.id === paneId)
    return pane?.tabs.find(t => t.id === tabId) ?? null
  })()

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
    >
      <SidebarSlotContext.Provider value={sidebarSlot}>
        <div className="flex min-h-0 flex-1 overflow-hidden">

          {/* Shared sidebar slot — only when multi-pane + focused pane has sidebar + sidebar open */}
          {isMultiPane && (
            <div
              ref={slotContainerRef}
              className="relative shrink-0 overflow-hidden"
              style={{ transition: 'width 150ms ease',
                width:           showSlot ? sidebarWidth : 0,
                borderRight:     showSlot ? '1px solid rgb(var(--border))' : 'none',
              }}
            >
              <div ref={setSidebarSlot} className="absolute inset-0" style={{ width: sidebarWidth }} />
              {/* Drag-to-resize handle */}
              <div
                aria-hidden
                className="absolute right-0 top-0 z-10 h-full w-1 cursor-col-resize opacity-0 transition-opacity hover:opacity-100 hover:bg-accent/40 active:opacity-100"
                onMouseDown={startResize}
              />
            </div>
          )}

          {/* Panes — on mobile only render the focused pane */}
          {(isMobile ? panes.filter(p => p.id === focusedPaneId) : panes).map((pane, index) => (
            <PaneIdContext.Provider key={pane.id} value={pane.id}>
              <div
                className={`flex min-w-0 flex-1 flex-col overflow-hidden ${
                  index > 0 ? 'border-l border-[rgb(var(--border))]' : ''
                }`}
                onPointerDownCapture={() => {
                  if (focusedPaneId !== pane.id) setFocusedPane(pane.id)
                }}
              >
                <PaneTabBar
                  paneId={pane.id}
                  draggingTabId={draggingId}
                  overDropTarget={overTarget}
                />
                <CustomNavProvider paneId={pane.id}>
                  <div className="min-h-0 flex-1 overflow-hidden">
                    <ErrorBoundary>
                      <AppRoutes />
                    </ErrorBoundary>
                  </div>
                </CustomNavProvider>
              </div>
            </PaneIdContext.Provider>
          ))}
        </div>
      </SidebarSlotContext.Provider>

      {/* Floating tab preview during drag */}
      <DragOverlay dropAnimation={null}>
        {draggedTab && (() => {
          const [paneId] = draggingId!.split(':')
          const pane     = panes.find(p => p.id === paneId)
          return (
            <TabPreview
              tab={draggedTab}
              isActive={draggedTab.id === pane?.activeTabId}
              title={deriveTitle(draggedTab.path, notes)}
            />
          )
        })()}
      </DragOverlay>
    </DndContext>
  )
}
