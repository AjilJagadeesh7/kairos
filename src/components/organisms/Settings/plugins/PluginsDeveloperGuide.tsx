import { useState } from 'react'
import type { IconToken } from '../../../../icons/tokens'
import { Icon } from '../../../../icons/Icon'
import { TabGettingStarted, TabApiReference } from './PluginDocTabs'
import { TabUIExtensions } from './PluginDocTabsExtensions'
import { TabDistribution } from './PluginDocTabsDist'

type DocTab = 'start' | 'api' | 'ui' | 'distribution'

const DOC_TABS: { id: DocTab; label: string; icon: IconToken; description: string }[] = [
  { id: 'start',        label: 'Getting Started', icon: 'graduation-cap', description: 'Your first plugin in 5 min' },
  { id: 'api',          label: 'API Reference',   icon: 'zap',            description: 'Notes, kanban, events'     },
  { id: 'ui',           label: 'UI Extensions',   icon: 'layout-list',    description: 'Slots, themes, editor'     },
  { id: 'distribution', label: 'Distribution',    icon: 'store',          description: 'Icons, marketplace, links' },
]

export function PluginsDeveloperGuide() {
  const [activeTab, setActiveTab] = useState<DocTab>('start')
  const active = DOC_TABS.find(t => t.id === activeTab)!

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text">Build a Plugin</h3>
        <a
          href="https://github.com/AjilJagadeesh7/mindvault#plugin-system"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-accent hover:underline"
        >
          <Icon name="external-link" size={11} />
          Full docs on GitHub
        </a>
      </div>

      {/* Tab picker */}
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {DOC_TABS.map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors ${
              activeTab === tab.id
                ? 'border-accent/40 bg-accent/8 text-accent'
                : 'border-border bg-surface text-text2 hover:border-border hover:bg-surface2'
            }`}
          >
            <Icon
              name={tab.icon}
              size={16}
              className={activeTab === tab.id ? 'text-accent' : 'text-text3'}
              strokeWidth={activeTab === tab.id ? 2 : 1.75}
            />
            <span className="text-xs font-medium leading-tight">{tab.label}</span>
            <span className={`text-[10px] leading-tight ${activeTab === tab.id ? 'text-accent/70' : 'text-text3'}`}>
              {tab.description}
            </span>
          </button>
        ))}
      </div>

      {/* Active tab content */}
      <div className="rounded-xl border border-border bg-surface p-4">
        <div className="mb-3 flex items-center gap-2 border-b border-border pb-3">
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-accent/10">
            <Icon name={active.icon} size={13} className="text-accent" />
          </div>
          <span className="text-xs font-semibold text-text">{active.label}</span>
        </div>

        {activeTab === 'start'        && <TabGettingStarted />}
        {activeTab === 'api'          && <TabApiReference />}
        {activeTab === 'ui'           && <TabUIExtensions />}
        {activeTab === 'distribution' && <TabDistribution />}
      </div>
    </div>
  )
}
