import { InstalledPlugins } from './plugins/InstalledPlugins'
import { PluginsDeveloperGuide } from './plugins/PluginsDeveloperGuide'

export function PluginsSection() {
  return (
    <div className="space-y-5">
      <InstalledPlugins />
      <PluginsDeveloperGuide />
    </div>
  )
}
