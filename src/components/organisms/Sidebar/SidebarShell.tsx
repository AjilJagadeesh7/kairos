import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'
import { usePaneStore } from '../../../store/usePaneStore'
import { usePaneId, useSidebarSlot } from '../../../contexts/PaneContext'
import { Sidebar } from './Sidebar'
import { SidebarWrapper } from './SidebarWrapper'
import { ErrorBoundary } from '../../common/ErrorBoundary'
import { VaultBanner } from '../../common/VaultBanner'

/**
 * The notes layout shell: the FILES sidebar (portalled in multi-pane, inline
 * otherwise) plus a main content area. Shared by the notes editor and the
 * attachment viewer so attachments open with the same chrome as notes.
 */
export function SidebarShell({ children, resetKeys }: { children: ReactNode; resetKeys?: unknown[] }) {
  const paneId        = usePaneId()
  const focusedPaneId = usePaneStore(s => s.focusedPaneId)
  const isMultiPane   = usePaneStore(s => s.panes.length > 1)
  const isFocused     = paneId === focusedPaneId
  const slot          = useSidebarSlot()
  const sidebar       = <Sidebar />

  return (
    <main className="relative flex h-full flex-col overflow-hidden">
      <VaultBanner />
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        {isMultiPane
          ? isFocused && slot ? createPortal(sidebar, slot) : null
          : <SidebarWrapper>{sidebar}</SidebarWrapper>
        }
        <section className="flex min-w-0 flex-1 flex-col">
          <ErrorBoundary resetKeys={resetKeys}>{children}</ErrorBoundary>
        </section>
      </div>
    </main>
  )
}
