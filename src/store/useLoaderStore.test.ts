import { describe, it, expect, beforeEach } from 'vitest'
import { useLoaderStore } from './useLoaderStore'

beforeEach(() => {
  useLoaderStore.setState({ tasks: {}, isLoading: false })
})

describe('useLoaderStore — push / pop', () => {
  it('push sets isLoading true and records the task', () => {
    useLoaderStore.getState().push('task-1', 'Loading notes')
    const { tasks, isLoading } = useLoaderStore.getState()
    expect(isLoading).toBe(true)
    expect(tasks['task-1']).toBe('Loading notes')
  })

  it('push with no label defaults to empty string', () => {
    useLoaderStore.getState().push('x')
    expect(useLoaderStore.getState().tasks['x']).toBe('')
  })

  it('pop removes the task', () => {
    useLoaderStore.getState().push('t')
    useLoaderStore.getState().pop('t')
    expect(useLoaderStore.getState().tasks['t']).toBeUndefined()
  })

  it('isLoading becomes false when all tasks are popped', () => {
    useLoaderStore.getState().push('a')
    useLoaderStore.getState().push('b')
    useLoaderStore.getState().pop('a')
    expect(useLoaderStore.getState().isLoading).toBe(true)
    useLoaderStore.getState().pop('b')
    expect(useLoaderStore.getState().isLoading).toBe(false)
  })

  it('pop on non-existent id is a no-op', () => {
    expect(() => useLoaderStore.getState().pop('missing')).not.toThrow()
  })
})

describe('useLoaderStore — run', () => {
  it('shows loader while fn runs, removes it after', async () => {
    let wasLoading = false
    await useLoaderStore.getState().run('op', async () => {
      wasLoading = useLoaderStore.getState().isLoading
    })
    expect(wasLoading).toBe(true)
    expect(useLoaderStore.getState().isLoading).toBe(false)
  })

  it('returns the resolved value from fn', async () => {
    const result = await useLoaderStore.getState().run('op', async () => 42)
    expect(result).toBe(42)
  })

  it('pops loader even when fn throws', async () => {
    await expect(
      useLoaderStore.getState().run('op', async () => { throw new Error('fail') })
    ).rejects.toThrow('fail')
    expect(useLoaderStore.getState().isLoading).toBe(false)
  })
})
