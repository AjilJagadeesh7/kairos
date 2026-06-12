import { vi, describe, it, expect, beforeEach } from 'vitest'

// Latest-wins merge for content categories (journal/kanban/canvas):
//  - remote newer than local → pull (writeLocal), no push
//  - local newer than remote → push (putBlob), no pull

const { provider, adapter } = vi.hoisted(() => {
  const provider = {
    id: 's3' as const,
    isConnected: () => true,
    putBlob: vi.fn().mockResolvedValue(undefined),
    listBlob: vi.fn().mockResolvedValue([]),
    deleteBlob: vi.fn().mockResolvedValue(undefined),
  }
  const adapter = {
    category: 'kanban' as const,
    toSynced: (i: unknown) => i,
    listLocal: vi.fn(),
    parse: (blob: { name: string; content: string }) => JSON.parse(blob.content),
    writeLocal: vi.fn().mockResolvedValue(undefined),
    reload: vi.fn().mockResolvedValue(undefined),
  }
  return { provider, adapter }
})

vi.mock('./remoteProvider', () => ({ connectedProviders: () => [provider], anyRemoteConnected: () => true }))
vi.mock('./syncRules', () => ({ canPush: () => true, canPull: () => true }))
vi.mock('./categoryRegistry', () => ({ CONTENT_ADAPTERS: { kanban: adapter } }))
vi.mock('./settingsSync', () => ({ syncConfigWithCloud: vi.fn().mockResolvedValue(undefined) }))
vi.mock('./plainFolder', () => ({
  isPlainFolderConnected: () => true,
  readAllNotes: vi.fn().mockResolvedValue([]),
  writePlainNote: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('../db/schema', () => ({
  db: { syncMeta: { put: vi.fn().mockResolvedValue(undefined), get: vi.fn().mockResolvedValue(undefined), delete: vi.fn().mockResolvedValue(undefined) } },
}))

import { syncAllProviders } from './syncOrchestrator'

const remoteBlob = (item: object) => ({ name: 'b1.json', content: JSON.stringify(item) })

describe('content category latest-wins', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    provider.putBlob.mockResolvedValue(undefined)
    provider.deleteBlob.mockResolvedValue(undefined)
    adapter.writeLocal.mockResolvedValue(undefined)
    adapter.reload.mockResolvedValue(undefined)
  })

  it('pushes when local is newer than remote', async () => {
    adapter.listLocal.mockResolvedValue([{ id: 'b1', filename: 'b1.json', updatedAt: '2026-01-02T00:00:00Z', content: 'LOCAL', noSync: false }])
    provider.listBlob.mockImplementation((cat: string) =>
      Promise.resolve(cat === 'kanban' ? [remoteBlob({ id: 'b1', filename: 'b1.json', updatedAt: '2026-01-01T00:00:00Z', content: 'REMOTE', noSync: false })] : []))

    await syncAllProviders(vi.fn())

    expect(provider.putBlob).toHaveBeenCalledWith('kanban', 'b1.json', 'LOCAL')
    expect(adapter.writeLocal).not.toHaveBeenCalled()
  })

  it('pulls when remote is newer than local', async () => {
    adapter.listLocal.mockResolvedValue([{ id: 'b1', filename: 'b1.json', updatedAt: '2026-01-01T00:00:00Z', content: 'LOCAL', noSync: false }])
    provider.listBlob.mockImplementation((cat: string) =>
      Promise.resolve(cat === 'kanban' ? [remoteBlob({ id: 'b1', filename: 'b1.json', updatedAt: '2026-01-03T00:00:00Z', content: 'REMOTE', noSync: false })] : []))

    await syncAllProviders(vi.fn())

    expect(adapter.writeLocal).toHaveBeenCalledWith({ name: 'b1.json', content: expect.stringContaining('REMOTE') })
    expect(provider.putBlob).not.toHaveBeenCalledWith('kanban', 'b1.json', 'LOCAL')
    expect(adapter.reload).toHaveBeenCalled()
  })

  it('pushes over a remote with a missing/invalid updatedAt (valid side wins)', async () => {
    adapter.listLocal.mockResolvedValue([{ id: 'b1', filename: 'b1.json', updatedAt: '2026-01-02T00:00:00Z', content: 'LOCAL', noSync: false }])
    provider.listBlob.mockImplementation((cat: string) =>
      Promise.resolve(cat === 'kanban' ? [remoteBlob({ id: 'b1', filename: 'b1.json', content: 'REMOTE', noSync: false })] : []))

    await syncAllProviders(vi.fn())

    expect(provider.putBlob).toHaveBeenCalledWith('kanban', 'b1.json', 'LOCAL')
    expect(adapter.writeLocal).not.toHaveBeenCalled()
  })

  it('pulls a remote with a valid updatedAt over an undated local', async () => {
    adapter.listLocal.mockResolvedValue([{ id: 'b1', filename: 'b1.json', updatedAt: undefined, content: 'LOCAL', noSync: false }])
    provider.listBlob.mockImplementation((cat: string) =>
      Promise.resolve(cat === 'kanban' ? [remoteBlob({ id: 'b1', filename: 'b1.json', updatedAt: '2026-01-03T00:00:00Z', content: 'REMOTE', noSync: false })] : []))

    await syncAllProviders(vi.fn())

    expect(adapter.writeLocal).toHaveBeenCalledWith({ name: 'b1.json', content: expect.stringContaining('REMOTE') })
    expect(provider.putBlob).not.toHaveBeenCalledWith('kanban', 'b1.json', 'LOCAL')
  })

  it('still pushes a local item with no updatedAt when the remote copy is absent', async () => {
    adapter.listLocal.mockResolvedValue([{ id: 'b1', filename: 'b1.json', updatedAt: undefined, content: 'LOCAL', noSync: false }])
    provider.listBlob.mockResolvedValue([])

    await syncAllProviders(vi.fn())

    expect(provider.putBlob).toHaveBeenCalledWith('kanban', 'b1.json', 'LOCAL')
  })

  it('continues with remaining items when one item fails to write locally', async () => {
    adapter.listLocal.mockResolvedValue([])
    provider.listBlob.mockImplementation((cat: string) =>
      Promise.resolve(cat === 'kanban' ? [
        { name: 'bad.json', content: JSON.stringify({ id: 'bad', filename: 'bad.json', updatedAt: '2026-01-03T00:00:00Z', content: 'BAD', noSync: false }) },
        { name: 'good.json', content: JSON.stringify({ id: 'good', filename: 'good.json', updatedAt: '2026-01-03T00:00:00Z', content: 'GOOD', noSync: false }) },
      ] : []))
    adapter.writeLocal.mockImplementation(({ name }: { name: string }) =>
      name === 'bad.json' ? Promise.reject(new Error('disk full')) : Promise.resolve())

    const onStatus = vi.fn()
    await syncAllProviders(onStatus)

    expect(adapter.writeLocal).toHaveBeenCalledWith({ name: 'good.json', content: expect.stringContaining('GOOD') })
    // The run completes — a single bad item must not flip the whole sync to error.
    expect(onStatus).toHaveBeenLastCalledWith('ok')
  })
})
