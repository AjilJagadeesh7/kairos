/** Plugin bundles and their data — `vault/plugins/{id}/`. */
import { isDesktop } from '../utils/platform'
import {
  ensureVaultDir, getVaultPath, listVaultDir, readVaultText, removeVaultDir, writeVaultText,
} from './vaultFs'

export async function listPluginIds(): Promise<string[]> {
  const names = await listVaultDir('plugins', { directories: true })
  return names.filter(name => !name.startsWith('.'))
}

export function readPluginFile(pluginId: string, filename: string): Promise<string | null> {
  return readVaultText(`plugins/${pluginId}/${filename}`)
}

export async function writePluginFile(pluginId: string, filename: string, content: string): Promise<void> {
  if (isDesktop() && !getVaultPath()) throw new Error('Vault not connected')
  await ensureVaultDir(`plugins/${pluginId}`)
  await writeVaultText(`plugins/${pluginId}/${filename}`, content)
}

export function deletePluginFolder(pluginId: string): Promise<void> {
  return removeVaultDir(`plugins/${pluginId}`)
}
