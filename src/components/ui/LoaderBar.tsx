import { useLoaderStore } from '../../store/useLoaderStore'

/**
 * Thin progress bar pinned to the very top of the viewport.
 * Uses an indeterminate animation — no need to track real progress.
 * Only mounts in the DOM when there's actually something loading.
 */
export function LoaderBar(): JSX.Element | null {
  const isLoading = useLoaderStore((s) => s.isLoading)
  if (!isLoading) return null

  return (
    <div
      aria-hidden="true"
      className="loader-bar pointer-events-none fixed inset-x-0 top-0 z-[9999] h-[2px]"
      style={{ background: 'rgb(var(--surface-3))' }}
    >
      <div className="loader-bar-fill h-full" style={{ background: 'rgb(var(--accent))' }} />
    </div>
  )
}
