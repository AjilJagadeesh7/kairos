import { useState } from 'react'
import type { IconToken } from '../../../../icons/tokens'
import { SectionCard } from '../../../molecules/SectionCard'
import { Icon } from '../../../../icons/Icon'
import { TabGettingStarted, TabApiReference, TabIconPacks, TabDistribution } from './PluginDocTabs'

type DocTab = 'start' | 'api' | 'icons' | 'distribution'

const DOC_TABS: { id: DocTab; label: string; icon: IconToken }[] = [
  { id: 'start',        label: 'Getting Started', icon: 'graduation-cap' },
  { id: 'api',          label: 'API Reference',   icon: 'zap'            },
  { id: 'icons',        label: 'Icon Packs',      icon: 'palette'        },
  { id: 'distribution', label: 'Distribution',    icon: 'store'          },
]

export function PluginsDeveloperGuide() {
  const [activeTab, setActiveTab] = useState<DocTab>('start')

  return (
    <SectionCard title="Build a Plugin">
      <div className="mb-4 flex gap-1 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] p-1">
        {DOC_TABS.map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-[rgb(var(--surface))] text-[rgb(var(--text))] shadow-sm'
                : 'text-[rgb(var(--text-3))] hover:text-[rgb(var(--text-2))]'
            }`}
          >
            <Icon name={tab.icon} size={12} className="shrink-0" />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'start'        && <TabGettingStarted />}
      {activeTab === 'api'          && <TabApiReference />}
      {activeTab === 'icons'        && <TabIconPacks />}
      {activeTab === 'distribution' && <TabDistribution />}

      <div className="mt-4 flex items-center gap-2 rounded-lg border border-[rgb(var(--accent))]/20 bg-[rgb(var(--accent))]/5 px-3 py-2.5">
        <Icon name="external-link" size={13} className="shrink-0 text-[rgb(var(--accent))]" />
        <p className="text-xs text-[rgb(var(--text-2))]">
          Full docs and an example plugin at{' '}
          <a
            href="https://github.com/AjilJagadeesh7/mindvault"
            target="_blank"
            rel="noopener noreferrer"
            className="font-medium text-[rgb(var(--accent))] hover:underline"
          >
            github.com/AjilJagadeesh7/mindvault
          </a>
        </p>
      </div>
    </SectionCard>
  )
}
