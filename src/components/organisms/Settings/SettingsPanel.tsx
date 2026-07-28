import { Icon } from '../../../icons/Icon'
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
import { PublishSection } from './PublishSection'
import type { IconToken } from '../../../icons/tokens'
import type { Section } from '../../../types'

interface SettingsPanelProps {
  section: Section
}

const SECTION_META: Partial<Record<Section, { label: string; description: string; icon: IconToken }>> = {
  'general':      { label: 'General',          description: 'Profile, new-tab page, appearance',        icon: 'settings-2'      },
  'storage-sync': { label: 'Storage & Sync',   description: 'Vault location, cloud sync',               icon: 'folder-sync'     },
  'tags':         { label: 'Tags',             description: 'Manage and colour your note tags',          icon: 'tag'             },
  'callouts':     { label: 'Callouts',         description: 'Custom callout types and styles',           icon: 'brackets'        },
  'keyboard':     { label: 'Keyboard',         description: 'Shortcuts and key bindings',                icon: 'keyboard'        },
  'publish':      { label: 'Publish & Export', description: 'Export notes to HTML, Markdown or PDF',    icon: 'send'            },
  'plugins':      { label: 'Plugins',          description: 'Installed plugins and developer tools',     icon: 'puzzle'          },
  'marketplace':  { label: 'Marketplace',      description: 'Discover and install new plugins',          icon: 'store'           },
  'updates':      { label: 'Updates',          description: 'App version and release notes',             icon: 'arrow-up-right' },
  'logs':         { label: 'Logs',             description: 'Runtime and error logs',                    icon: 'scroll-text'     },
  'about':        { label: 'About',            description: 'Version info, credits, and licences',       icon: 'info'            },
}

export function SettingsPanel({ section }: SettingsPanelProps) {
  if (section === 'marketplace') {
    return <MarketplaceSection />
  }

  const meta = SECTION_META[section]

  return (
    <div className="flex h-full flex-col">
      {meta && (
        <div className="border-b border-border px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10">
              <Icon name={meta.icon} size={16} className="text-accent" strokeWidth={2} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-text">{meta.label}</h2>
              <p className="text-xs text-text3">{meta.description}</p>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-5xl space-y-4">
          {section === 'general'      && <GeneralSection />}
          {section === 'storage-sync' && <SyncSection />}
          {section === 'tags'         && <TagsSection />}
          {section === 'callouts'     && <CalloutsSection />}
          {section === 'keyboard'     && <KeyboardSection />}
          {section === 'plugins'      && <PluginsSection />}
          {section === 'updates'      && <UpdatesSection />}
          {section === 'logs'         && <LogsSection />}
          {section === 'about'        && <AboutSection />}
          {section === 'publish'      && <PublishSection />}
        </div>
      </div>
    </div>
  )
}
