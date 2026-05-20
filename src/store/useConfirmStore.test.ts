import { describe, it, expect, beforeEach } from 'vitest'
import { useConfirmStore } from './useConfirmStore'

beforeEach(() => {
  useConfirmStore.setState({ open: false, opts: { title: '' }, _resolve: null })
})

describe('useConfirmStore', () => {
  it('confirm opens the dialog with provided options', () => {
    void useConfirmStore.getState().confirm({ title: 'Delete note?', danger: true })
    const { open, opts } = useConfirmStore.getState()
    expect(open).toBe(true)
    expect(opts.title).toBe('Delete note?')
    expect(opts.danger).toBe(true)
  })

  it('_answer(true) resolves the promise with true', async () => {
    const promise = useConfirmStore.getState().confirm({ title: 'Sure?' })
    useConfirmStore.getState()._answer(true)
    expect(await promise).toBe(true)
  })

  it('_answer(false) resolves the promise with false', async () => {
    const promise = useConfirmStore.getState().confirm({ title: 'Sure?' })
    useConfirmStore.getState()._answer(false)
    expect(await promise).toBe(false)
  })

  it('_answer closes the dialog', async () => {
    const promise = useConfirmStore.getState().confirm({ title: 'Sure?' })
    useConfirmStore.getState()._answer(true)
    await promise
    expect(useConfirmStore.getState().open).toBe(false)
  })

  it('_resolve is null after answering', async () => {
    const promise = useConfirmStore.getState().confirm({ title: 'X' })
    useConfirmStore.getState()._answer(false)
    await promise
    expect(useConfirmStore.getState()._resolve).toBeNull()
  })
})
