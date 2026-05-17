import { BrainCircuit, FolderSync, Info, Puzzle, Settings2, Store, Tag, X } from 'lucide-react'
import { usePluginRegistry } from '../../../plugins/pluginContext'
import type { Section } from '../../../types'

interface SettingsSidebarProps {
  section: Section
  onSectionChange: (s: Section) => void
  onClose?: () => void
}

const CORE_NAV: Array<{ id: Section; label: string; icon: React.ElementType }> = [
  { id: 'general',      label: 'General',          icon: Settings2    },
  { id: 'storage-sync', label: 'Storage & Sync',   icon: FolderSync   },
  { id: 'tags',         label: 'Tags',             icon: Tag          },
  { id: 'ai',           label: 'AI',               icon: BrainCircuit },
  { id: 'plugins',      label: 'Plugins',          icon: Puzzle       },
  { id: 'marketplace',  label: 'Marketplace',      icon: Store        },
  { id: 'about',        label: 'About',            icon: Info         },
]

export function SettingsSidebar({ section, onSectionChange, onClose }: SettingsSidebarProps) {
  const { settings: pluginSettings } = usePluginRegistry()

  const allNav = [
    ...CORE_NAV,
    ...pluginSettings.map(s => ({
      id: s.id as Section,
      label: s.label,
      icon: s.icon ?? Puzzle,
    })),
  ]

  return (
    <aside className="flex h-full w-full flex-col border-r border-border bg-surface2">
      <div className="flex items-center gap-2 border-b border-border px-3 py-3">
        <span className="flex-1 text-xs font-semibold uppercase tracking-widest text-text3">
          Settings
        </span>
        {onClose && (
          <button
            type="button"
            aria-label="Close sidebar"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-md text-text2 transition hover:bg-surface3 hover:text-text xl:hidden"
          >
            <X size={16} />
          </button>
        )}
      </div>

      <nav className="flex flex-col gap-0.5 p-2">
        {allNav.map(({ id, label, icon: Icon }) => (
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
            <Icon size={15} className="shrink-0" />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </aside>
  )
}
