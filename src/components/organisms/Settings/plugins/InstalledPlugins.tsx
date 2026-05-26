import { usePluginStore } from '../../../../plugins/usePluginStore'
import { uninstallPlugin } from '../../../../plugins/installPlugin'
import { Button } from '../../../atoms/Button'
import { ToggleSwitch } from '../../../atoms/ToggleSwitch'
import { Icon } from '../../../../icons/Icon'

export function InstalledPlugins() {
  const plugins    = usePluginStore(s => s.plugins)
  const setEnabled = usePluginStore(s => s.setEnabled)

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-text">Installed Plugins</h3>
        {plugins.length > 0 && (
          <span className="rounded-full bg-surface3 px-2 py-0.5 text-[11px] text-text3">
            {plugins.length} installed
          </span>
        )}
      </div>

      {plugins.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-surface2">
            <Icon name="store" size={22} className="text-text3" />
          </div>
          <div>
            <p className="text-sm font-medium text-text2">No plugins installed yet</p>
            <p className="mt-0.5 text-xs text-text3">Go to the Marketplace tab to discover plugins.</p>
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {plugins.map(plugin => (
              <div
                key={plugin.id}
                className={`flex flex-col rounded-xl border bg-surface p-4 transition-opacity ${
                  plugin.enabled ? 'border-border' : 'border-border/50 opacity-55'
                }`}
              >
                <div className="mb-3 flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface2">
                    <Icon name="puzzle" size={17} className="text-text3" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-text">{plugin.manifest.name}</p>
                    <div className="mt-0.5 flex items-center gap-1.5">
                      <span className="rounded bg-surface3 px-1.5 py-px font-mono text-[10px] text-text3">
                        v{plugin.manifest.version}
                      </span>
                      {!plugin.enabled && (
                        <span className="rounded bg-surface3 px-1.5 py-px text-[10px] text-text3">
                          disabled
                        </span>
                      )}
                    </div>
                  </div>
                  <ToggleSwitch
                    checked={plugin.enabled}
                    onChange={v => setEnabled(plugin.id, v)}
                    size="sm"
                    label={plugin.enabled ? 'Disable plugin' : 'Enable plugin'}
                  />
                </div>

                <p className="flex-1 text-xs leading-relaxed text-text2">
                  {plugin.manifest.description}
                </p>

                <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-3">
                  <span className="text-[11px] text-text3">by {plugin.manifest.author}</span>
                  <Button
                    variant="ghost"
                    size="xs"
                    className="text-text3 hover:text-red-400"
                    onClick={() => void uninstallPlugin(plugin.id)}
                  >
                    Remove
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-text3">
            Enable/disable changes take effect after restarting the app.
          </p>
        </>
      )}
    </div>
  )
}
