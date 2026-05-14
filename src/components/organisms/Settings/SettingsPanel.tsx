import type { Section } from '../../../types'
import { GeneralSection } from './GeneralSection'
import { SyncSection } from './SyncSection'
import { StorageSection } from './StorageSection'
import { AboutSection } from './AboutSection'

interface SettingsPanelProps {
  section: Section
}

export function SettingsPanel({ section }: SettingsPanelProps) {
  return (
    <div className="p-6">
      <div className="mx-auto max-w-2xl space-y-4">
        {section === 'general' && <GeneralSection />}
        {section === 'sync'    && <SyncSection />}
        {section === 'storage' && <StorageSection />}
        {section === 'about'   && <AboutSection />}
      </div>
    </div>
  )
}
