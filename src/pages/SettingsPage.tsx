import { createPortal } from 'react-dom'
import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { usePaneStore } from '../store/usePaneStore'
import { usePaneId, useSidebarSlot } from '../contexts/PaneContext'
import { SidebarWrapper } from '../components/organisms/Sidebar/SidebarWrapper'
import { SettingsPanel } from '../components/organisms/Settings/SettingsPanel'
import { SettingsSidebar } from '../components/organisms/Settings/SettingsSidebar'
import type { Section } from '../types'

export function SettingsPage() {
  const { search }               = useLocation()
  const [section, setSection]    = useState<Section>(() => {
    const s = new URLSearchParams(search).get('section') as Section | null
    return s ?? 'storage-sync'
  })

  useEffect(() => {
    const s = new URLSearchParams(search).get('section') as Section | null
    if (s) setSection(s)
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
