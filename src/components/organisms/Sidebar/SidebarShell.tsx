import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'
import { usePaneStore } from '../../../store/usePaneStore'
import { usePaneId, useSidebarSlot } from '../../../contexts/PaneContext'
import { Sidebar } from './Sidebar'
import { SidebarWrapper } from './SidebarWrapper'
import { ErrorBoundary } from '../../common/ErrorBoundary'
import { VaultBanner } from '../../common/VaultBanner'

/**
 * A section layout shell: a sidebar (portalled in multi-pane, inline otherwise)
 * plus a main content area. Defaults to the notes FILES sidebar, but callers can
 * pass their own — e.g. the attachment viewer supplies the journal calendar so a
 * journal file opens with journal chrome, not notes chrome.
 */
export function SidebarShell({ children, resetKeys, sidebar }: { children: ReactNode; resetKeys?: unknown[]; sidebar?: ReactNode }) {
  const paneId        = usePaneId()
  const focusedPaneId = usePaneStore(s => s.focusedPaneId)
  const isMultiPane   = usePaneStore(s => s.panes.length > 1)
  const isFocused     = paneId === focusedPaneId
  const slot          = useSidebarSlot()
  const sidebarEl     = sidebar ?? <Sidebar />

  return (
    <main className="relative flex h-full flex-col overflow-hidden">
      <VaultBanner />
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        {isMultiPane
          ? isFocused && slot ? createPortal(sidebarEl, slot) : null
          : <SidebarWrapper>{sidebarEl}</SidebarWrapper>
        }
        <section className="flex min-w-0 flex-1 flex-col">
          <ErrorBoundary resetKeys={resetKeys}>{children}</ErrorBoundary>
        </section>
      </div>
    </main>
  )
}
