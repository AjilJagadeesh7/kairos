export interface SyncAdapter {
  /**
   * Upload a file to the remote.
   * @param filePath  Remote path / key (e.g. "kairos/abc123.md")
   * @param content   UTF-8 file content (serialized note with frontmatter)
   */
  push(filePath: string, content: string): Promise<void>

  /**
   * Download a file from the remote.
   * @returns UTF-8 file content, or throws if not found
   */
  pull(filePath: string): Promise<string>

  /** List all remote file paths managed by this adapter. */
  listRemote(): Promise<string[]>

  /**
   * Resolve a write conflict between a local and remote version.
   * Default policy: last-write-wins based on the `updatedAt` frontmatter field.
   *
   * @param local   Serialized local note content
   * @param remote  Serialized remote note content
   * @returns The content that should be kept
   */
  resolveConflict(local: string, remote: string): Promise<string>

  /**
   * Authenticate / configure the adapter.
   * @param config  Provider-specific key-value config
   */
  connect(config: Record<string, string>): Promise<void>
}

/** Parse the `updatedAt` ISO string from serialized note frontmatter. */
export function extractUpdatedAt(content: string): number {
  const match = content.match(/^updatedAt: (.+)$/m)
  if (!match) return 0
  return new Date(match[1].trim()).getTime()
}

/** Last-write-wins conflict resolution using `updatedAt` frontmatter timestamps. */
export function lastWriteWins(local: string, remote: string): string {
  return extractUpdatedAt(local) >= extractUpdatedAt(remote) ? local : remote
}
