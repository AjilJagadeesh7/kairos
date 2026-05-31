import { useAppStore } from '../../../store/useAppStore'
import { ToggleSwitch } from '../../atoms/ToggleSwitch'
import { SectionLabel } from '../../atoms/SectionLabel'
import { SYNC_CATEGORIES } from '../../../types'
import type { SyncCategory } from '../../../types'

const LABELS: Record<SyncCategory, { label: string; hint: string }> = {
  notes:    { label: 'Notes',    hint: 'Markdown notes' },
  journal:  { label: 'Journal',  hint: 'Daily entries' },
  kanban:   { label: 'Kanban',   hint: 'Boards & tasks' },
  canvas:   { label: 'Canvas',   hint: 'Visual canvases' },
  settings: { label: 'Settings', hint: 'Theme, fonts, preferences' },
  secrets:  { label: 'Secrets',  hint: 'Provider credentials — kept on this device unless enabled' },
}

/** Per-category Push ↑ / Pull ↓ toggles controlling what syncs to/from the cloud. */
export function SyncScopeSection() {
  const syncScope       = useAppStore((s) => s.syncScope)
  const setSyncCategory = useAppStore((s) => s.setSyncCategory)

  return (
    <div>
      <SectionLabel className="mb-3">What to sync</SectionLabel>
      <div className="divide-y divide-[rgb(var(--border))] overflow-hidden rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))]">
        <div className="flex items-center px-4 py-2 text-[10px] uppercase tracking-widest text-[rgb(var(--text-3))]">
          <span className="flex-1">Type</span>
          <span className="w-14 text-center">Push ↑</span>
          <span className="w-14 text-center">Pull ↓</span>
        </div>
        {SYNC_CATEGORIES.map((cat) => (
          <div key={cat} className="flex items-center px-4 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="text-sm text-[rgb(var(--text))]">{LABELS[cat].label}</p>
              <p className="truncate text-xs text-[rgb(var(--text-3))]">{LABELS[cat].hint}</p>
            </div>
            <div className="flex w-14 justify-center">
              <ToggleSwitch checked={syncScope[cat].push} onChange={(v) => setSyncCategory(cat, 'push', v)} label={`${cat} push`} />
            </div>
            <div className="flex w-14 justify-center">
              <ToggleSwitch checked={syncScope[cat].pull} onChange={(v) => setSyncCategory(cat, 'pull', v)} label={`${cat} pull`} />
            </div>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-[rgb(var(--text-3))]">
        Push sends local changes to the cloud; Pull brings cloud changes down. Each type and direction is independent — turn off anything you want to keep local-only.
      </p>
    </div>
  )
}
