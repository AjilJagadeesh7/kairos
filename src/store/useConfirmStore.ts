import { create } from 'zustand'

export type ConfirmOptions = {
  title: string
  message?: string
  confirmLabel?: string
  danger?: boolean
}

type ConfirmState = {
  open: boolean
  opts: ConfirmOptions
  /** Resolves true (confirm) or false (cancel/dismiss) */
  _resolve: ((confirmed: boolean) => void) | null
  /**
   * Show the confirm dialog and return a promise.
   * await confirm({ title: 'Delete note?', danger: true })
   */
  confirm: (opts: ConfirmOptions) => Promise<boolean>
  _answer: (confirmed: boolean) => void
}

const DEFAULT_OPTS: ConfirmOptions = { title: '', confirmLabel: 'Confirm' }

export const useConfirmStore = create<ConfirmState>()((set, get) => ({
  open: false,
  opts: DEFAULT_OPTS,
  _resolve: null,

  confirm: (opts) => {
    return new Promise<boolean>((resolve) => {
      set({ open: true, opts, _resolve: resolve })
    })
  },

  _answer: (confirmed) => {
    const { _resolve } = get()
    set({ open: false, opts: DEFAULT_OPTS, _resolve: null })
    _resolve?.(confirmed)
  },
}))
