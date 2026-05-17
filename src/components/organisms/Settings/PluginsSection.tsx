import { Store } from 'lucide-react'
import { usePluginStore } from '../../../plugins/usePluginStore'
import { uninstallPlugin } from '../../../plugins/installPlugin'
import { SectionCard } from '../../molecules/SectionCard'
import { Button } from '../../atoms/Button'

export function PluginsSection() {
  const plugins    = usePluginStore(s => s.plugins)
  const setEnabled = usePluginStore(s => s.setEnabled)

  if (plugins.length === 0) {
    return (
      <SectionCard title="Installed Plugins">
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <Store size={28} className="text-[rgb(var(--text-3))]" />
          <p className="text-sm text-[rgb(var(--text-2))]">No plugins installed yet.</p>
          <p className="text-xs text-[rgb(var(--text-3))]">
            Go to the <strong className="text-[rgb(var(--text-2))]">Marketplace</strong> tab to discover plugins.
          </p>
        </div>
      </SectionCard>
    )
  }

  return (
    <div className="space-y-4">
      <SectionCard title="Installed Plugins">
        <ul className="space-y-2">
          {plugins.map(plugin => (
            <li
              key={plugin.id}
              className="flex items-start justify-between gap-4 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] p-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[rgb(var(--text))]">{plugin.manifest.name}</span>
                  <span className="rounded bg-[rgb(var(--surface-3))] px-1.5 py-0.5 font-mono text-[10px] text-[rgb(var(--text-3))]">
                    v{plugin.manifest.version}
                  </span>
                  {!plugin.enabled && (
                    <span className="rounded bg-[rgb(var(--surface-3))] px-1.5 py-0.5 text-[10px] text-[rgb(var(--text-3))]">
                      disabled
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-[rgb(var(--text-2))]">{plugin.manifest.description}</p>
                <p className="mt-0.5 text-[11px] text-[rgb(var(--text-3))]">by {plugin.manifest.author}</p>
              </div>

              <div className="flex shrink-0 items-center gap-2.5">
                {/* Enable / disable toggle */}
                <button
                  type="button"
                  role="switch"
                  aria-checked={plugin.enabled}
                  title={plugin.enabled ? 'Disable plugin (takes effect after restart)' : 'Enable plugin (takes effect after restart)'}
                  onClick={() => setEnabled(plugin.id, !plugin.enabled)}
                  className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[rgb(var(--accent))]/50 ${
                    plugin.enabled
                      ? 'bg-[rgb(var(--accent))]'
                      : 'bg-[rgb(var(--surface-3))]'
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                      plugin.enabled ? 'translate-x-[18px]' : 'translate-x-[3px]'
                    }`}
                  />
                </button>

                <Button
                  variant="ghost"
                  size="xs"
                  className="text-[rgb(var(--text-3))] hover:text-red-400"
                  onClick={() => void uninstallPlugin(plugin.id)}
                >
                  Remove
                </Button>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[11px] text-[rgb(var(--text-3))]">
          Enable/disable changes take effect after restarting the app.
        </p>
      </SectionCard>
    </div>
  )
}
