import { useState } from 'react'
import { useAppStore } from '../store/useAppStore'
import { SettingsPanel } from '../components/Settings/SettingsPanel'
import { SettingsSidebar } from '../components/Settings/SettingsSidebar'
import type { Section } from '../components/Settings/SettingsPanel'

export function SettingsPage() {
  const [section, setSection] = useState<Section>('general')
  const mobileSidebarOpen    = useAppStore((s) => s.mobileSidebarOpen)
  const setMobileSidebarOpen = useAppStore((s) => s.setMobileSidebarOpen)

  return (
    <main className="relative flex h-full overflow-hidden">
      {/* Mobile backdrop */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/40 xl:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Sidebar drawer */}
      <div
        className={`fixed inset-y-0 left-0 z-30 w-72 transition-transform duration-300 ease-in-out xl:relative xl:inset-auto xl:z-auto xl:w-[220px] xl:translate-x-0 xl:flex-shrink-0 ${
          mobileSidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        }`}
      >
        <SettingsSidebar
          section={section}
          onSectionChange={setSection}
          onClose={() => setMobileSidebarOpen(false)}
        />
      </div>

      {/* Content */}
      <section className="flex min-w-0 flex-1 flex-col overflow-y-auto border-l border-border">
        <SettingsPanel section={section} />
      </section>
    </main>
  )
}
