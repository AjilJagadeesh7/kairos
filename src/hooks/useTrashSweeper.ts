import { useEffect } from 'react'
import { useAppStore } from '../store/useAppStore'
import { sweepExpiredTrash } from '../trash/trashService'

/** How often the retention sweep re-runs while the app stays open. */
const SWEEP_INTERVAL_MS = 60 * 60 * 1000  // 1 hour

/**
 * The retention timer. Purges trash items past the configured window on startup,
 * then hourly, and again whenever the retention setting changes (so shortening
 * it takes effect immediately rather than at the next tick).
 *
 * Desktop/mobile apps stay open for days, so an interval is the right shape here
 * — there is no server-side cron to lean on, and a missed window is simply
 * caught by the next startup sweep.
 */
export function useTrashSweeper(): void {
  const retentionDays = useAppStore(s => s.trashRetentionDays)

  useEffect(() => {
    if (retentionDays <= 0) return

    let cancelled = false
    const sweep = () => {
      void sweepExpiredTrash(retentionDays)
        .then(n => { if (n > 0 && !cancelled) console.info(`[trash] purged ${n} expired item(s)`) })
        .catch(err => console.warn('[trash] sweep failed:', err))
    }

    sweep()
    const timer = setInterval(sweep, SWEEP_INTERVAL_MS)
    return () => { cancelled = true; clearInterval(timer) }
  }, [retentionDays])
}
