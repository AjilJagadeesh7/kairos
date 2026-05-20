import type { PluginPermission, PluginManifest } from './types'

export class PermissionError extends Error {
  readonly pluginId: string
  readonly permission: PluginPermission

  constructor(pluginId: string, permission: PluginPermission, action: string) {
    super(`Plugin "${pluginId}" attempted "${action}" without the "${permission}" permission`)
    this.name = 'PermissionError'
    this.pluginId = pluginId
    this.permission = permission
  }
}

/**
 * Throw a PermissionError if the manifest does not declare the required permission.
 * Call this at the top of every API method before touching any app state.
 */
export function gate(manifest: PluginManifest, required: PluginPermission, action: string): void {
  if (!manifest.permissions.includes(required)) {
    throw new PermissionError(manifest.id, required, action)
  }
}
