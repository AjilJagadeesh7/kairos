import type { RemoteEncryptedNote } from './types'

export type { RemoteEncryptedNote } from './types'
export { toRemotePayload } from './types'

declare global {
  interface Window {
    gapi: {
      load: (module: string, callback: () => void) => void
      client: {
        init: (config: Record<string, unknown>) => Promise<void>
        drive: {
          files: {
            list: (payload: Record<string, unknown>) => Promise<{ result: { files: Array<{ id: string; name: string; modifiedTime?: string }> } }>
            create: (payload: Record<string, unknown>) => Promise<{ result: { id: string } }>
            update: (payload: Record<string, unknown>) => Promise<void>
            get: (payload: Record<string, unknown>) => Promise<{ body: string }>
          }
        }
      }
      auth2: {
        getAuthInstance: () => {
          signIn: () => Promise<void>
          signOut: () => Promise<void>
          isSignedIn: { get: () => boolean }
        }
      }
    }
  }
}

export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.appdata'

export async function initDriveClient(clientId: string, apiKey: string): Promise<void> {
  if (!window.gapi) throw new Error('Google API client is unavailable')

  await new Promise<void>((resolve) => {
    window.gapi.load('client:auth2', () => resolve())
  })

  await window.gapi.client.init({
    apiKey,
    clientId,
    discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
    scope: DRIVE_SCOPE,
  })
}

export function isDriveConnected(): boolean {
  try {
    return window.gapi.auth2.getAuthInstance().isSignedIn.get()
  } catch {
    return false
  }
}

export async function connectDrive(): Promise<void> {
  await window.gapi.auth2.getAuthInstance().signIn()
}

export async function disconnectDrive(): Promise<void> {
  await window.gapi.auth2.getAuthInstance().signOut()
}

export async function listRemoteNotes(): Promise<RemoteEncryptedNote[]> {
  const response = await window.gapi.client.drive.files.list({
    spaces: 'appDataFolder',
    fields: 'files(id,name,modifiedTime)',
    pageSize: 500,
  })

  const files = response.result.files || []
  const notes: RemoteEncryptedNote[] = []

  for (const file of files) {
    if (!file.id || !file.name || !file.name.startsWith('kairos-note-')) continue
    try {
      const content = await window.gapi.client.drive.files.get({
        fileId: file.id,
        alt: 'media',
      })

      const parsed = JSON.parse(content.body) as RemoteEncryptedNote
      notes.push({ ...parsed, fileId: file.id })
    } catch {
      // Skip malformed remote payloads and continue.
    }
  }

  return notes
}

export async function upsertRemoteNote(remote: RemoteEncryptedNote, fileId?: string): Promise<string> {
  const metadata = {
    name: `kairos-note-${remote.noteId}.json`,
    mimeType: 'application/json',
    parents: ['appDataFolder'],
  }

  const media = {
    mimeType: 'application/json',
    body: JSON.stringify(remote),
  }

  if (fileId) {
    await window.gapi.client.drive.files.update({
      fileId,
      resource: metadata,
      media,
    })
    return fileId
  }

  const created = await window.gapi.client.drive.files.create({
    resource: metadata,
    media,
    fields: 'id',
  })

  return created.result.id
}
