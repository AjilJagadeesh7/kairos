import { createPortal } from 'react-dom'
import { useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useCanvasStore } from '../store/useCanvasStore'
import { usePaneStore } from '../store/usePaneStore'
import { usePaneId, useSidebarSlot } from '../contexts/PaneContext'
import { SidebarWrapper } from '../components/organisms/Sidebar/SidebarWrapper'
import { CanvasSidebar } from '../components/organisms/Canvas/CanvasSidebar'
import { CanvasList } from '../components/organisms/Canvas/CanvasList'
import { CanvasView } from '../components/organisms/Canvas/CanvasView'
import { ErrorBoundary } from '../components/common/ErrorBoundary'
import { VaultBanner } from '../components/common/VaultBanner'
import { Icon } from '../icons/Icon'

export function CanvasPage() {
  const { canvasId }  = useParams<{ canvasId?: string }>()
  const canvases      = useCanvasStore(s => s.canvases)
  const isLoaded      = useCanvasStore(s => s.isLoaded)
  const loadCanvases  = useCanvasStore(s => s.loadCanvases)
  const paneId        = usePaneId()
  const focusedPaneId = usePaneStore(s => s.focusedPaneId)
  const isMultiPane   = usePaneStore(s => s.panes.length > 1)
  const isFocused     = paneId === focusedPaneId
  const slot          = useSidebarSlot()

  useEffect(() => {
    if (!isLoaded) void loadCanvases()
  }, [isLoaded, loadCanvases])

  if (!isLoaded) {
    return (
      <main className="flex h-full items-center justify-center">
        <Icon name="loader-2" size={24} className="animate-spin text-[rgb(var(--text-3))]" />
      </main>
    )
  }

  const activeCanvas = canvasId ? canvases.find(c => c.id === canvasId) ?? null : null
  const sidebar = <CanvasSidebar />

  return (
    <main className="relative flex h-full flex-col overflow-hidden">
      <VaultBanner />
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        {isMultiPane
          ? isFocused && slot ? createPortal(sidebar, slot) : null
          : <SidebarWrapper>{sidebar}</SidebarWrapper>
        }

        <section className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <ErrorBoundary resetKeys={[canvasId]}>
            {activeCanvas ? (
              <CanvasView canvas={activeCanvas} />
            ) : (
              <CanvasList />
            )}
          </ErrorBoundary>
        </section>
      </div>
    </main>
  )
}
