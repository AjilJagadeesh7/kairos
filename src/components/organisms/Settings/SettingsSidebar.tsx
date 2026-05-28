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

type NavGroup = { heading?: string; items: Array<{ id: Section; label: string; iconName: IconToken }> }

const NAV_GROUPS: NavGroup[] = [
  {
    heading: 'Workspace',
    items: [
      { id: 'general',      label: 'General',          iconName: 'settings-2'      },
      { id: 'storage-sync', label: 'Storage & Sync',   iconName: 'folder-sync'     },
      { id: 'tags',         label: 'Tags',             iconName: 'tag'             },
      { id: 'callouts',     label: 'Callouts',         iconName: 'brackets'        },
      { id: 'keyboard',     label: 'Keyboard',         iconName: 'keyboard'        },
      { id: 'publish',      label: 'Publish & Export', iconName: 'send'            },
    ],
  },
  {
    heading: 'Extensions',
    items: [
      { id: 'plugins',      label: 'Plugins',          iconName: 'puzzle'          },
      { id: 'marketplace',  label: 'Marketplace',      iconName: 'store'           },
    ],
  },
  {
    heading: 'App',
    items: [
      { id: 'updates',      label: 'Updates',          iconName: 'arrow-up-right' },
      { id: 'logs',         label: 'Logs',             iconName: 'scroll-text'     },
      { id: 'about',        label: 'About',            iconName: 'info'            },
    ],
  },
]

export function SettingsSidebar({ section, onSectionChange, onClose }: SettingsSidebarProps) {
  return (
    <aside className="flex h-full w-full flex-col border-r border-border bg-surface2">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3.5">
        <Icon name="settings-2" size={15} className="shrink-0 text-text3" />
        <SectionLabel className="flex-1">Settings</SectionLabel>
        {onClose && (
          <IconButton icon="x" label="Close sidebar" size="md" onClick={onClose} className="xl:hidden" />
        )}
      </div>

      <nav className="flex flex-col gap-4 overflow-y-auto p-3">
        {NAV_GROUPS.map(group => (
          <div key={group.heading}>
            {group.heading && (
              <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-widest text-text3">
                {group.heading}
              </p>
            )}
            <div className="flex flex-col gap-0.5">
              {group.items.map(({ id, label, iconName }) => {
                const active = section === id
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => { onSectionChange(id); onClose?.() }}
                    className={`relative flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors ${
                      active
                        ? 'bg-accent/10 font-medium text-accent'
                        : 'text-text2 hover:bg-surface3 hover:text-text'
                    }`}
                  >
                    {active && (
                      <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-r-full bg-accent" />
                    )}
                    <Icon name={iconName} size={15} className="shrink-0" strokeWidth={active ? 2 : 1.75} />
                    <span>{label}</span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  )
}
