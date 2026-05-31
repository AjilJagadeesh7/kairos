/**
 * Stable per-device identifier. Used to key device-specific config files so
 * multiple devices syncing to the same endpoint never clobber each other's
 * local settings (e.g. storage choices). Never synced itself.
 */
import { v4 as uuidv4 } from 'uuid'

const KEY = 'kairos_device_id'

export function getDeviceId(): string {
  let id = localStorage.getItem(KEY)
  if (!id) {
    id = uuidv4()
    localStorage.setItem(KEY, id)
  }
  return id
}
