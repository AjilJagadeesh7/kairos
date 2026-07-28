import { createPortal } from 'react-dom'
import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { usePaneStore } from '../store/usePaneStore'
import { usePaneId, useSidebarSlot } from '../contexts/PaneContext'
import { SidebarWrapper } from '../components/organisms/Sidebar/SidebarWrapper'
import { SettingsPanel } from '../components/organisms/Settings/SettingsPanel'
import { SettingsSidebar } from '../components/organisms/Settings/SettingsSidebar'
import { isMarketplaceEnabled } from '../utils/marketplace'
import type { Section } from '../types'

/**
 * Sections the sidebar no longer lists, and where a deep link to one should land
 * instead. The components still exist — only the entry points are hidden.
 */
const HIDDEN_SECTIONS: Record<string, Section> = {
  storage: 'storage-sync',   // "Storage & Limits" — see StorageSection.tsx
}

/**
 * A `?section=` deep link can name a section this build doesn't surface (an old
 * bookmark, a link from another install). Land on its closest sibling rather than
 * a tab the sidebar no longer lists, so the panel and the sidebar stay in sync.
 */
function resolveSection(raw: string | null): Section {
  if (!raw) return 'storage-sync'
  if (raw === 'marketplace' && !isMarketplaceEnabled()) return 'plugins'
  return HIDDEN_SECTIONS[raw] ?? (raw as Section)
}

export function SettingsPage() {
  const { search }               = useLocation()
  const [section, setSection]    = useState<Section>(
    () => resolveSection(new URLSearchParams(search).get('section')),
  )

  useEffect(() => {
    const s = new URLSearchParams(search).get('section')
    if (s) setSection(resolveSection(s))
  }, [search])
  const paneId                   = usePaneId()
  const focusedPaneId            = usePaneStore(s => s.focusedPaneId)
  const isMultiPane              = usePaneStore(s => s.panes.length > 1)
  const isFocused                = paneId === focusedPaneId
  const slot                     = useSidebarSlot()

  const settingsSidebar = (
    <SettingsSidebar
      section={section}
      onSectionChange={setSection}
    />
  )

  return (
    <main className="relative flex h-full overflow-hidden">
      {isMultiPane
        ? isFocused && slot ? createPortal(settingsSidebar, slot) : null
        : <SidebarWrapper>{settingsSidebar}</SidebarWrapper>
      }

      <section className="flex min-w-0 flex-1 flex-col overflow-y-auto">
        <SettingsPanel section={section} />
      </section>
    </main>
  )
}
