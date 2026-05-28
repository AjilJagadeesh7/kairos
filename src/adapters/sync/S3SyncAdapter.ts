/**
 * S3-compatible SyncAdapter (adapter-layer wrapper around src/sync/s3.ts).
 * Notes are stored as plain .md files — no encryption.
 */
import type { SyncAdapter } from './SyncAdapter'
import { lastWriteWins } from './SyncAdapter'
import {
  setS3Config, isS3Connected, listS3Notes, upsertS3Note, type S3Config,
} from '../../sync/s3'
import { serializeNote, deserializeNote } from '../storage/noteSerializer'
export class S3SyncAdapter implements SyncAdapter {
  private config: S3Config | null = null

  async connect(config: Record<string, string>): Promise<void> {
    const { endpoint, bucket, region, accessKeyId, secretAccessKey } = config
    if (!endpoint || !bucket || !accessKeyId || !secretAccessKey) {
      throw new Error('S3: endpoint, bucket, accessKeyId and secretAccessKey are required')
    }
    this.config = { endpoint, bucket, region: region || 'auto', accessKey: accessKeyId, secretKey: secretAccessKey }
    setS3Config(this.config)
  }

  async push(_filePath: string, content: string): Promise<void> {
    this.assertConnected()
    const note = deserializeNote(content)
    await upsertS3Note(note)
  }

  async pull(filePath: string): Promise<string> {
    this.assertConnected()
    const notes = await listS3Notes()
    const found = notes.find((n) => `kairos/${n.id}.md` === filePath || n.id === filePath)
    if (!found) throw new Error(`S3: object not found: ${filePath}`)
    return serializeNote(found)
  }

  async listRemote(): Promise<string[]> {
    this.assertConnected()
    const notes = await listS3Notes()
    return notes.map((n) => `kairos/${n.id}.md`)
  }

  async resolveConflict(local: string, remote: string): Promise<string> {
    return lastWriteWins(local, remote)
  }

  isConnected(): boolean { return isS3Connected() }

  private assertConnected(): void {
    if (!isS3Connected()) throw new Error('S3SyncAdapter: not connected. Call connect() first.')
  }
}

export type { S3Config }
