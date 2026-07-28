import { Button } from '../../../atoms/Button'
import { Icon } from '../../../../icons/Icon'
import { openExternal } from '../../../../utils/openExternal'
import type { PageMeta } from '../../../../utils/webReader'

function hostOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return url }
}

/**
 * Last tier: a rich preview built from OpenGraph metadata. Used when a page
 * refuses framing *and* has no extractable prose (search pages, dashboards,
 * login walls), or when the fetch itself failed.
 */
export function WebLinkCard({ meta, url, reason }: {
  meta: PageMeta | null
  url: string
  reason?: string
}): JSX.Element {
  const host = hostOf(url)

  return (
    <div className="nodrag nopan flex h-full flex-col overflow-y-auto bg-[rgb(var(--surface-2))]">
      {meta?.image && (
        <img
          src={meta.image}
          alt=""
          loading="lazy"
          referrerPolicy="no-referrer"
          className="h-32 w-full shrink-0 object-cover"
        />
      )}

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-center gap-1.5">
          {meta?.favicon
            ? <img src={meta.favicon} alt="" className="h-3.5 w-3.5 rounded-sm" referrerPolicy="no-referrer" />
            : <Icon name="globe" size={13} className="text-[rgb(var(--text-3))]" />}
          <span className="truncate text-[10px] uppercase tracking-wider text-[rgb(var(--text-3))]">
            {meta?.siteName ?? host}
          </span>
        </div>

        <p className="text-[14px] font-semibold leading-snug text-[rgb(var(--text))]">
          {meta?.title ?? host}
        </p>

        {meta?.description && (
          <p className="line-clamp-4 text-[11px] leading-relaxed text-[rgb(var(--text-2))]">
            {meta.description}
          </p>
        )}

        {reason && (
          <p className="text-[10px] leading-relaxed text-[rgb(var(--text-3))]">{reason}</p>
        )}

        <div className="mt-auto pt-2">
          <Button variant="hollow" size="xs" className="nodrag nopan"
            onPointerDown={e => e.stopPropagation()}
            onClick={() => void openExternal(url)}>
            <Icon name="external-link" size={11} /> Open in browser
          </Button>
        </div>
      </div>
    </div>
  )
}
