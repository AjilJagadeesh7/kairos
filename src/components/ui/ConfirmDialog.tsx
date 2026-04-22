import { useEffect, useRef } from 'react'
import { useConfirmStore } from '../../store/useConfirmStore'

/**
 * App-wide confirmation dialog.
 * Driven entirely by useConfirmStore — never instantiated with props.
 * Usage anywhere in the app:
 *   const ok = await useConfirmStore.getState().confirm({ title: 'Delete?', danger: true })
 */
export function ConfirmDialog(): JSX.Element | null {
  const { open, opts, _answer } = useConfirmStore()
  const confirmBtnRef = useRef<HTMLButtonElement>(null)
  const cancelBtnRef = useRef<HTMLButtonElement>(null)

  // Auto-focus the cancel button (safer default) when dialog opens
  useEffect(() => {
    if (open) cancelBtnRef.current?.focus()
  }, [open])

  // Keyboard: Escape = cancel, Enter = confirm
  useEffect(() => {
    if (!open) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); _answer(false) }
      if (e.key === 'Enter')  { e.preventDefault(); _answer(true) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [open, _answer])

  if (!open) return null

  const confirmLabel = opts.confirmLabel ?? 'Confirm'

  return (
    /* Backdrop */
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-title"
      className="fixed inset-0 z-[9998] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) _answer(false) }}
    >
      {/* Panel */}
      <div
        className="confirm-dialog w-full max-w-sm rounded-xl border border-border bg-surface p-6 shadow-2xl"
        style={{ animation: 'confirm-in 0.15s ease-out' }}
      >
        <h2 id="confirm-title" className="mb-1 text-base font-semibold text-text">
          {opts.title}
        </h2>
        {opts.message && (
          <p className="mb-5 text-sm text-text2">{opts.message}</p>
        )}
        {!opts.message && <div className="mb-5" />}

        <div className="flex justify-end gap-2">
          <button
            ref={cancelBtnRef}
            type="button"
            onClick={() => _answer(false)}
            className="btn btn-ghost btn-sm"
          >
            Cancel
          </button>
          <button
            ref={confirmBtnRef}
            type="button"
            onClick={() => _answer(true)}
            className={`btn btn-sm font-semibold ${
              opts.danger
                ? 'bg-red-500 text-white hover:bg-red-600'
                : 'btn-primary'
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
