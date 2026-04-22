import { create } from 'zustand'

type LoaderState = {
  /** Each key is a task ID, value is a human-readable label */
  tasks: Record<string, string>
  isLoading: boolean
  /** Register a task as in-progress */
  push: (id: string, label?: string) => void
  /** Remove a task from progress */
  pop: (id: string) => void
  /**
   * Convenience wrapper: shows loader while `fn` runs, removes it when done.
   * Always resolves — errors are re-thrown after cleanup.
   */
  run: <T>(id: string, fn: () => Promise<T>, label?: string) => Promise<T>
}

export const useLoaderStore = create<LoaderState>()((set, get) => ({
  tasks: {},
  isLoading: false,

  push: (id, label = '') => {
    set((s) => {
      const tasks = { ...s.tasks, [id]: label }
      return { tasks, isLoading: true }
    })
  },

  pop: (id) => {
    set((s) => {
      const tasks = { ...s.tasks }
      delete tasks[id]
      return { tasks, isLoading: Object.keys(tasks).length > 0 }
    })
  },

  run: async (id, fn, label) => {
    get().push(id, label)
    try {
      return await fn()
    } finally {
      get().pop(id)
    }
  },
}))
