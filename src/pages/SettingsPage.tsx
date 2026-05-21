import { createPortal } from 'react-dom'
import { useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { usePaneStore } from '../store/usePaneStore'
import { usePaneId, useSidebarSlot } from '../contexts/PaneContext'
import { SettingsPanel } from '../components/organisms/Settings/SettingsPanel'
import { SettingsSidebar } from '../components/organisms/Settings/SettingsSidebar'
import type { Section } from '../types'

export function SettingsPage() {
  const [section, setSection]    = useState<Section>('storage-sync')
  const mobileSidebarOpen        = useAppStore((s) => s.mobileSidebarOpen)
  const setMobileSidebarOpen     = useAppStore((s) => s.setMobileSidebarOpen)
  const paneId                   = usePaneId()
  const focusedPaneId            = usePaneStore(s => s.focusedPaneId)
  const isMultiPane              = usePaneStore(s => s.panes.length > 1)
  const isFocused                = paneId === focusedPaneId
  const slot                     = useSidebarSlot()

  const settingsSidebar = (
    <SettingsSidebar
      section={section}
      onSectionChange={setSection}
      onClose={() => setMobileSidebarOpen(false)}
    />
  )

  return (
    <main className="relative flex h-full overflow-hidden">
      {isMultiPane
        ? isFocused && slot ? createPortal(settingsSidebar, slot) : null
        : (
          <>
            {mobileSidebarOpen && (
              <div
                className="fixed inset-0 z-20 bg-black/40 xl:hidden"
                onClick={() => setMobileSidebarOpen(false)}
              />
            )}
            <div
              className={`fixed inset-y-0 left-0 z-30 w-72 transition-transform duration-300 ease-in-out xl:relative xl:inset-auto xl:z-auto xl:w-[220px] xl:translate-x-0 xl:flex-shrink-0 ${
                mobileSidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
              }`}
            >
              {settingsSidebar}
            </div>
          </>
        )
      }

      <section className={`flex min-w-0 flex-1 flex-col overflow-y-auto ${!isMultiPane ? 'border-l border-border' : ''}`}>
        <SettingsPanel section={section} />
      </section>
    </main>
  )
}
