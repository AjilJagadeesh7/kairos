import { toast } from 'sonner'
import { usePluginStore } from './usePluginStore'
import { useConfirmStore } from '../store/useConfirmStore'
import { loadSinglePlugin } from './pluginManager'
import type { PluginManifest, PluginInstallRequest, InstalledPlugin } from './types'

// ─── Install ──────────────────────────────────────────────────────────────────

export async function installPlugin(request: PluginInstallRequest): Promise<boolean> {
  const { id, manifestUrl, bundleUrl } = request

  if (usePluginStore.getState().isInstalled(id)) {
    toast.info(`Plugin "${id}" is already installed`)
    return false
  }

  // 1. Fetch + validate manifest
  let manifest: PluginManifest
  try {
    const res = await fetch(manifestUrl)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    manifest = await res.json() as PluginManifest
    if (!manifest.id || !manifest.name || !manifest.version || !manifest.entryPoint) {
      throw new Error('Invalid manifest: missing required fields')
    }
    if (manifest.id !== id) {
      throw new Error(`Manifest id "${manifest.id}" does not match requested id "${id}"`)
    }
  } catch (err) {
    toast.error('Failed to fetch plugin manifest', { description: String(err) })
    return false
  }

  // 2. Confirm with user
  const permissionList = manifest.permissions.length > 0
    ? manifest.permissions.join(', ')
    : 'none'

  const confirmed = await useConfirmStore.getState().confirm({
    title: `Install "${manifest.name}"?`,
    message: `v${manifest.version} by ${manifest.author}\n\n${manifest.description}\n\nPermissions: ${permissionList}`,
    confirmLabel: 'Install',
  })
  if (!confirmed) return false

  // 3. Fetch bundle
  let bundleCode: string
  try {
    const res = await fetch(bundleUrl)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    bundleCode = await res.text()
  } catch (err) {
    toast.error('Failed to download plugin bundle', { description: String(err) })
    return false
  }

  // 4. Write to vault
  try {
    const { writePluginFile } = await import('../sync/plainFolder')
    await writePluginFile(id, 'manifest.json', JSON.stringify(manifest, null, 2))
    await writePluginFile(id, manifest.entryPoint, bundleCode)
  } catch (err) {
    toast.error('Failed to save plugin to vault', { description: String(err) })
    return false
  }

  // 5. Persist install record
  const installed: InstalledPlugin = {
    id,
    manifest,
    enabled: true,
    installedAt: new Date().toISOString(),
    source: new URL(manifestUrl).origin,
  }
  usePluginStore.getState().addPlugin(installed)

  // 6. Load immediately — no restart required for fresh installs
  try {
    await loadSinglePlugin(id)
    toast.success(`"${manifest.name}" installed and activated`)
  } catch (err) {
    toast.warning(`Plugin installed but failed to activate — it will load on next restart`, { description: String(err) })
  }

  return true
}

// ─── Uninstall ────────────────────────────────────────────────────────────────

export async function uninstallPlugin(id: string): Promise<void> {
  const plugin = usePluginStore.getState().getPlugin(id)
  if (!plugin) return

  const confirmed = await useConfirmStore.getState().confirm({
    title: `Uninstall "${plugin.manifest.name}"?`,
    message: 'This removes the plugin files from your vault. Changes take full effect after restart.',
    confirmLabel: 'Uninstall',
    danger: true,
  })
  if (!confirmed) return

  try {
    const { deletePluginFolder } = await import('../sync/plainFolder')
    await deletePluginFolder(id)
  } catch { /* best-effort */ }

  usePluginStore.getState().removePlugin(id)
  toast.success(`"${plugin.manifest.name}" uninstalled — restart to fully remove`)
}

// ─── Deep link / URL param handler ───────────────────────────────────────────

export async function handleInstallDeepLink(url: string): Promise<void> {
  // mindvault://install?id=plugin-id&source=https://marketplace.example.com
  try {
    const parsed = new URL(url)
    if (parsed.hostname !== 'install') return
    const id     = parsed.searchParams.get('id')
    const source = parsed.searchParams.get('source')
    if (!id || !source) return
    await installPlugin({
      id,
      manifestUrl: `${source}/plugins/${id}/manifest.json`,
      bundleUrl:   `${source}/plugins/${id}/index.js`,
    })
  } catch (err) {
    console.warn('[plugins] failed to parse deep link:', url, err)
  }
}
