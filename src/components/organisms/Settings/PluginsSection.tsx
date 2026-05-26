import { useState } from 'react'
import { usePluginRegistry } from '../../../plugins/pluginContext'
import { ErrorBoundary } from '../../common/ErrorBoundary'
import { InstalledPlugins } from './plugins/InstalledPlugins'
import { PluginsDeveloperGuide } from './plugins/PluginsDeveloperGuide'
import { Icon } from '../../../icons/Icon'
import type { PluginSettingsRegistration } from '../../../plugins/types'

function PluginSettingsCard({ s }: { s: PluginSettingsRegistration }) {
  const [open, setOpen] = useState(true)
  const PluginIcon = s.icon

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-surface2"
      >
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-accent/10">
          {PluginIcon
            ? <PluginIcon size={14} className="text-accent" />
            : <Icon name="puzzle" size={14} className="text-accent" />
          }
        </div>
        <span className="flex-1 text-sm font-medium text-text">{s.label}</span>
        <Icon
          name={open ? 'chevron-up' : 'chevron-down'}
          size={15}
          className="shrink-0 text-text3 transition-transform"
        />
      </button>

      {open && (
        <div className="border-t border-border">
          <ErrorBoundary
            fallback={
              <div className="p-4 text-sm text-red-400">
                This plugin's settings failed to render.
              </div>
            }
          >
            <s.component />
          </ErrorBoundary>
        </div>
      )}
    </div>
  )
}

export function PluginsSection() {
  const { settings: pluginSettings } = usePluginRegistry()

  return (
    <div className="space-y-8">
      <InstalledPlugins />

      {pluginSettings.length > 0 && (
        <div>
          <div className="mb-3 flex items-center gap-2">
            <h3 className="text-sm font-semibold text-text">Plugin Settings</h3>
            <span className="rounded-full bg-surface3 px-2 py-0.5 text-[11px] text-text3">
              {pluginSettings.length}
            </span>
          </div>
          <div className="space-y-3">
            {pluginSettings.map(s => (
              <PluginSettingsCard key={s.id} s={s} />
            ))}
          </div>
        </div>
      )}

      <PluginsDeveloperGuide />
    </div>
  )
}
