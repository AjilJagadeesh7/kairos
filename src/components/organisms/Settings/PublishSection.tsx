import { useMemo, useState } from 'react'
import { useAppStore } from '../../../store/useAppStore'
import { exportVaultNotes, type ExportProgress } from '../../../utils/publishSiteGenerator'
import { SectionLabel } from '../../atoms/SectionLabel'
import { Divider } from '../../atoms/Divider'
import { Icon } from '../../../icons/Icon'

type Format = 'html' | 'markdown'

export function PublishSection() {
  const notes = useAppStore(s => s.notes)

  const [search, setSearch]           = useState('')
  const [selected, setSelected]       = useState<Set<string>>(new Set())
  const [format, setFormat]           = useState<Format>('html')
  const [progress, setProgress]       = useState<ExportProgress | null>(null)
  const [result, setResult]           = useState<{ exported: number; errors: string[] } | null>(null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return q ? notes.filter(n => n.title.toLowerCase().includes(q) || n.tags.some(t => t.toLowerCase().includes(q))) : notes
  }, [notes, search])

  const allFilteredSelected = filtered.length > 0 && filtered.every(n => selected.has(n.id))

  const toggle = (id: string) =>
    setSelected(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })

  const toggleAll = () => {
    if (allFilteredSelected) {
      setSelected(prev => { const next = new Set(prev); filtered.forEach(n => next.delete(n.id)); return next })
    } else {
      setSelected(prev => { const next = new Set(prev); filtered.forEach(n => next.add(n.id)); return next })
    }
  }

  const selectedNotes = notes.filter(n => selected.has(n.id))

  const handleExport = async () => {
    if (!selectedNotes.length) return
    setResult(null)
    setProgress({ done: 0, total: selectedNotes.length })
    const res = await exportVaultNotes(selectedNotes, format, p => setProgress(p))
    setProgress(null)
    setResult(res)
  }

  const isExporting = progress !== null

  return (
    <div className="space-y-6">
      <div>
        <SectionLabel className="mb-1">Publish &amp; Export</SectionLabel>
        <p className="text-sm text-text2">
          Select notes to export. Each note saves as its own file. On desktop you will be prompted for a folder.
        </p>
      </div>

      <Divider />

      {/* Format toggle */}
      <div>
        <p className="mb-2 text-sm font-medium text-text">Format</p>
        <div className="flex gap-2">
          {(['html', 'markdown'] as Format[]).map(f => (
            <button
              key={f}
              type="button"
              onClick={() => setFormat(f)}
              className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition ${format === f ? 'border-accent/60 bg-accent/10 text-accent' : 'border-border bg-surface text-text2 hover:border-accent/40 hover:text-text'}`}
            >
              <Icon name={f === 'html' ? 'globe' : 'file-text'} size={12} />
              {f === 'html' ? 'HTML' : 'Markdown'}
            </button>
          ))}
        </div>
      </div>

      <Divider />

      {/* Note list */}
      <div>
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-text">Notes</p>
          <div className="flex items-center gap-2">
            <span className="text-xs text-text3">{selected.size} selected</span>
            <button type="button" onClick={toggleAll} className="text-xs text-accent hover:underline">
              {allFilteredSelected ? 'Deselect all' : 'Select all'}
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="mb-2 flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-1.5">
          <Icon name="search" size={13} className="shrink-0 text-text3" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Filter notes…"
            className="flex-1 bg-transparent text-sm text-text outline-none placeholder:text-text3"
          />
          {search && (
            <button type="button" onClick={() => setSearch('')} className="text-text3 hover:text-text">
              <Icon name="x" size={12} />
            </button>
          )}
        </div>

        {/* List */}
        <div className="max-h-64 overflow-y-auto rounded-md border border-border bg-surface">
          {filtered.length === 0 ? (
            <p className="px-3 py-4 text-center text-xs text-text3">No notes match</p>
          ) : (
            filtered.map(note => (
              <label key={note.id} className="flex cursor-pointer items-center gap-3 border-b border-border px-3 py-2 last:border-b-0 hover:bg-surface2">
                <input
                  type="checkbox"
                  checked={selected.has(note.id)}
                  onChange={() => toggle(note.id)}
                  className="accent-[rgb(var(--accent))] shrink-0"
                />
                <span className="flex-1 truncate text-sm text-text">{note.title || 'Untitled'}</span>
                {note.tags.length > 0 && (
                  <span className="shrink-0 text-xs text-text3">{note.tags.slice(0, 2).map(t => `#${t}`).join(' ')}</span>
                )}
              </label>
            ))
          )}
        </div>
      </div>

      <Divider />

      {/* Export button + feedback */}
      <div className="space-y-2">
        <button
          type="button"
          disabled={!selectedNotes.length || isExporting}
          onClick={() => void handleExport()}
          className="flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-text2 transition hover:border-accent/50 hover:text-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Icon name={isExporting ? 'loader-2' : 'download'} size={14} className={isExporting ? 'animate-spin' : ''} />
          {isExporting ? `Exporting ${progress!.done} / ${progress!.total}…` : `Export ${selectedNotes.length || ''} note${selectedNotes.length !== 1 ? 's' : ''}`}
        </button>

        {result && !isExporting && (
          <div className={`flex items-start gap-2 rounded-md border px-3 py-2 text-xs ${result.errors.length === 0 ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400'}`}>
            <Icon name={result.errors.length === 0 ? 'check-circle-2' : 'alert-triangle'} size={13} className="mt-0.5 shrink-0" />
            <div>
              <p>{result.exported} note{result.exported !== 1 ? 's' : ''} exported successfully{result.errors.length > 0 ? ` · ${result.errors.length} failed` : '.'}</p>
              {result.errors.length > 0 && (
                <ul className="mt-1 space-y-0.5 opacity-80">
                  {result.errors.map((e, i) => <li key={i}>{e}</li>)}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
