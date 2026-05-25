import { usePluginRegistry } from '../../../plugins/pluginContext'
import { ErrorBoundary } from '../../common/ErrorBoundary'
import { GeneralSection } from './GeneralSection'
import { SyncSection } from './SyncSection'
import { TagsSection } from './TagsSection'
import { CalloutsSection } from './CalloutsSection'
import { AboutSection } from './AboutSection'
import { KeyboardSection } from './KeyboardSection'
import { LogsSection } from './LogsSection'
import { PluginsSection } from './PluginsSection'
import { MarketplaceSection } from './MarketplaceSection'
import { UpdatesSection } from './UpdatesSection'
import type { Section } from '../../../types'

interface SettingsPanelProps {
  section: Section
}

export function SettingsPanel({ section }: SettingsPanelProps) {
  const { settings: pluginSettings } = usePluginRegistry()
  const pluginSection = pluginSettings.find(s => s.id === section)

  // Marketplace gets full-bleed (no padding wrapper)
  if (section === 'marketplace') {
    return <MarketplaceSection />
  }

  return (
    <div className="p-6">
      <div className="mx-auto max-w-2xl space-y-4">
        {section === 'general'      && <GeneralSection />}
        {section === 'storage-sync' && <SyncSection />}
        {section === 'tags'         && <TagsSection />}
        {section === 'callouts'     && <CalloutsSection />}
        {section === 'keyboard'     && <KeyboardSection />}
        {section === 'plugins'      && <PluginsSection />}
        {section === 'updates'      && <UpdatesSection />}
        {section === 'logs'         && <LogsSection />}
        {section === 'about'        && <AboutSection />}

        {/* Plugin-registered settings sections */}
        {pluginSection && (
          <ErrorBoundary fallback={
            <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-400">
              Plugin settings failed to render. Check the console for details.
            </div>
          }>
            <pluginSection.component />
          </ErrorBoundary>
        )}
      </div>
    </div>
  )
}
