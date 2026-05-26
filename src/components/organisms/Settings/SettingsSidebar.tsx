import { usePluginRegistry } from '../../../plugins/pluginContext'
import { Icon } from '../../../icons/Icon'
import { IconButton } from '../../atoms/IconButton'
import { SectionLabel } from '../../atoms/SectionLabel'
import type { IconToken } from '../../../icons/tokens'
import type { Section } from '../../../types'

interface SettingsSidebarProps {
  section: Section
  onSectionChange: (s: Section) => void
  onClose?: () => void
}

const CORE_NAV: Array<{ id: Section; label: string; iconName: IconToken }> = [
  { id: 'general',      label: 'General',          iconName: 'settings-2'  },
  { id: 'storage-sync', label: 'Storage & Sync',   iconName: 'folder-sync' },
  { id: 'tags',         label: 'Tags',             iconName: 'tag'         },
  { id: 'callouts',     label: 'Callouts',         iconName: 'brackets'    },
  { id: 'keyboard',     label: 'Keyboard',         iconName: 'keyboard'    },
  { id: 'publish',      label: 'Publish & Export', iconName: 'send'        },
  { id: 'plugins',      label: 'Plugins',          iconName: 'puzzle'      },
  { id: 'marketplace',  label: 'Marketplace',      iconName: 'store'       },
  { id: 'updates',      label: 'Updates',          iconName: 'arrow-up-circle' },
  { id: 'logs',         label: 'Logs',             iconName: 'scroll-text' },
  { id: 'about',        label: 'About',            iconName: 'info'        },
]

export function SettingsSidebar({ section, onSectionChange, onClose }: SettingsSidebarProps) {
  const { settings: pluginSettings } = usePluginRegistry()

  return (
    <aside className="flex h-full w-full flex-col border-r border-border bg-surface2">
      <div className="flex items-center gap-2 border-b border-border px-3 py-3">
        <SectionLabel className="flex-1">Settings</SectionLabel>
        {onClose && (
          <IconButton icon="x" label="Close sidebar" size="md" onClick={onClose} className="xl:hidden" />
        )}
      </div>

      <nav className="flex flex-col gap-0.5 p-2">
        {CORE_NAV.map(({ id, label, iconName }) => (
          <button
            key={id}
            type="button"
            onClick={() => { onSectionChange(id); onClose?.() }}
            className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors ${
              section === id
                ? 'bg-surface3 font-medium text-text'
                : 'text-text2 hover:bg-surface2 hover:text-text'
            }`}
          >
            <Icon name={iconName} size={15} className="shrink-0" />
            <span>{label}</span>
          </button>
        ))}

        {pluginSettings.map(s => {
          const PluginIcon = s.icon
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => { onSectionChange(s.id as Section); onClose?.() }}
              className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                section === s.id
                  ? 'bg-surface3 font-medium text-text'
                  : 'text-text2 hover:bg-surface2 hover:text-text'
              }`}
            >
              {PluginIcon
                ? <PluginIcon size={15} className="shrink-0" />
                : <Icon name="puzzle" size={15} className="shrink-0" />
              }
              <span>{s.label}</span>
            </button>
          )
        })}
      </nav>
    </aside>
  )
}
