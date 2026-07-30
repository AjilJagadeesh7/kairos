import { Dropdown } from './Dropdown'
import { Icon } from '../../icons/Icon'
import { useSortStore, useSortPref, isDefaultSort } from '../../store/useSortStore'
import { SORT_FIELD_LABEL, dirLabel } from '../../utils/sortItems'
import type { SortDir, SortField, SortScope } from '../../types'

const FIELDS: SortField[] = ['title', 'updated', 'created']
const DIRS: SortDir[] = ['asc', 'desc']

interface Props {
  scope: SortScope
  /** `icon` for sidebar headers, `button` for the roomier home-page toolbars. */
  variant?: 'icon' | 'button'
  className?: string
}

/** Sort field + direction picker, shared by a content type's sidebar and home page. */
export function SortMenu({ scope, variant = 'icon', className = '' }: Props): JSX.Element {
  const pref     = useSortPref(scope)
  const setField = useSortStore(s => s.setField)
  const setDir   = useSortStore(s => s.setDir)

  const active = !isDefaultSort(pref, scope)

  const summary = `Sort: ${SORT_FIELD_LABEL[pref.field]} · ${dirLabel(pref.field, pref.dir)}`

  // A real button (rather than the div other Dropdown callers pass) so the menu
  // is reachable from the keyboard; the click still bubbles to Dropdown's toggle.
  const trigger = variant === 'icon' ? (
    <button
      type="button"
      aria-label={summary}
      title={summary}
      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md transition hover:bg-surface3 hover:text-text ${
        active ? 'text-accent' : 'text-text2'
      }`}
    >
      <Icon name="arrow-up-down" size={13} aria-hidden />
    </button>
  ) : (
    <button
      type="button"
      aria-label={summary}
      title={summary}
      className="btn btn-hollow btn-sm inline-flex items-center gap-1.5"
    >
      <Icon name="arrow-up-down" size={13} aria-hidden />
      <span className="hidden sm:inline">{SORT_FIELD_LABEL[pref.field]}</span>
      <Icon name="chevron-down" size={11} aria-hidden className="text-text3" />
    </button>
  )

  return (
    <Dropdown trigger={trigger} className={className} portal>
      <div className="w-44" role="group" aria-label="Sort options">
        <p className="px-2 pb-1 pt-1.5 text-[10px] font-semibold uppercase tracking-wider text-text3">
          Sort by
        </p>
        {FIELDS.map(field => (
          <SortRow
            key={field}
            label={SORT_FIELD_LABEL[field]}
            checked={pref.field === field}
            onClick={() => setField(scope, field)}
          />
        ))}

        <div className="my-1 border-t border-border" />

        <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-text3">
          Order
        </p>
        {DIRS.map(dir => (
          <SortRow
            key={dir}
            label={dirLabel(pref.field, dir)}
            checked={pref.dir === dir}
            onClick={() => setDir(scope, dir)}
          />
        ))}
      </div>
    </Dropdown>
  )
}

function SortRow({ label, checked, onClick }: { label: string; checked: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="menuitemradio"
      aria-checked={checked}
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs transition hover:bg-surface3 ${
        checked ? 'text-text' : 'text-text2'
      }`}
    >
      <span className="flex w-3 shrink-0 justify-center">
        {checked && <Icon name="check" size={11} className="text-accent" aria-hidden />}
      </span>
      {label}
    </button>
  )
}
