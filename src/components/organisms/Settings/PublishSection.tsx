import { useMemo, useState } from 'react'
import { useAppStore } from '../../../store/useAppStore'
import { exportVaultNotes, type ExportProgress } from '../../../utils/publishSiteGenerator'
import { SectionLabel } from '../../atoms/SectionLabel'
import { Divider } from '../../atoms/Divider'
import { Icon } from '../../../icons/Icon'

type Format = 'html' | 'markdown'
type Scope  = 'all' | 'tags' | 'custom'

export function PublishSection() {
  const notes = useAppStore(s => s.notes)

  const [format, setFormat]         = useState<Format>('html')
  const [scope, setScope]           = useState<Scope>('all')
  const [selectedTags, setSelectedTags] = useState<Set<string>>(new Set())
  const [search, setSearch]         = useState('')
  const [selected, setSelected]     = useState<Set<string>>(new Set())
  const [progress, setProgress]     = useState<ExportProgress | null>(null)
  const [result, setResult]         = useState<{ exported: number; errors: string[] } | null>(null)

  const allTags = useMemo(() => {
    const counts = new Map<string, number>()
    for (const n of notes) for (const t of n.tags) counts.set(t, (counts.get(t) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }, [notes])

  const filteredCustom = useMemo(() => {
    const q = search.trim().toLowerCase()
    return q ? notes.filter(n => n.title.toLowerCase().includes(q) || n.tags.some(t => t.toLowerCase().includes(q))) : notes
  }, [notes, search])

  const allFilteredSelected = filteredCustom.length > 0 && filteredCustom.every(n => selected.has(n.id))

  const toggleCustom = (id: string) =>
    setSelected(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next })

  const toggleAllCustom = () => {
    if (allFilteredSelected) {
      setSelected(prev => { const next = new Set(prev); filteredCustom.forEach(n => next.delete(n.id)); return next })
    } else {
      setSelected(prev => { const next = new Set(prev); filteredCustom.forEach(n => next.add(n.id)); return next })
    }
  }

  const toggleTag = (tag: string) =>
    setSelectedTags(prev => { const next = new Set(prev); next.has(tag) ? next.delete(tag) : next.add(tag); return next })

  const notesToExport = useMemo(() => {
    if (scope === 'all')    return notes
    if (scope === 'tags')   return selectedTags.size === 0 ? [] : notes.filter(n => n.tags.some(t => selectedTags.has(t)))
    return notes.filter(n => selected.has(n.id))
  }, [scope, notes, selected, selectedTags])

  const handleExport = async () => {
    if (!notesToExport.length) return
    setResult(null)
    setProgress({ done: 0, total: notesToExport.length })
    const res = await exportVaultNotes(notesToExport, format, p => setProgress(p))
    setProgress(null)
    setResult(res)
  }

  const isExporting = progress !== null

  return (
    <div className="space-y-6">
      <div>
        <SectionLabel className="mb-1">Publish &amp; Export</SectionLabel>
        <p className="text-sm text-text2">
          Export notes as static files. On desktop you will be prompted to choose a destination folder.
        </p>
      </div>

      <Divider />

      {/* Format */}
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

      {/* Scope */}
      <div>
        <p className="mb-2 text-sm font-medium text-text">Scope</p>
        <div className="grid grid-cols-3 gap-2">
          {([
            { id: 'all',    label: 'All notes',   icon: 'files',      desc: `${notes.length} notes` },
            { id: 'tags',   label: 'By tag',      icon: 'tag',        desc: `${allTags.length} tags` },
            { id: 'custom', label: 'Custom',      icon: 'list-checks', desc: 'Pick individually' },
          ] as { id: Scope; label: string; icon: string; desc: string }[]).map(opt => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setScope(opt.id)}
              className={`flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition ${scope === opt.id ? 'border-accent/60 bg-accent/10' : 'border-border bg-surface hover:border-accent/30'}`}
            >
              <Icon name={opt.icon as any} size={15} className={scope === opt.id ? 'text-accent' : 'text-text3'} />
              <span className={`text-xs font-medium ${scope === opt.id ? 'text-accent' : 'text-text'}`}>{opt.label}</span>
              <span className="text-[11px] text-text3">{opt.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Tag picker */}
      {scope === 'tags' && (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs text-text3">Select one or more tags — all matching notes will be exported.</p>
            {selectedTags.size > 0 && (
              <button type="button" onClick={() => setSelectedTags(new Set())} className="text-xs text-text3 hover:text-text">Clear</button>
            )}
          </div>
          {allTags.length === 0 ? (
            <p className="text-xs text-text3">No tags found in your vault.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {allTags.map(([tag, count]) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => toggleTag(tag)}
                  className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition ${selectedTags.has(tag) ? 'border-accent/60 bg-accent/10 text-accent' : 'border-border bg-surface text-text2 hover:border-accent/30 hover:text-text'}`}
                >
                  #{tag}
                  <span className="text-[10px] opacity-60">{count}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Custom picker */}
      {scope === 'custom' && (
        <div>
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 flex-1 rounded-md border border-border bg-surface px-3 py-1.5">
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
            <button type="button" onClick={toggleAllCustom} className="shrink-0 text-xs text-accent hover:underline">
              {allFilteredSelected ? 'Deselect all' : 'Select all'}
            </button>
          </div>

          <div className="max-h-56 overflow-y-auto rounded-md border border-border bg-surface">
            {filteredCustom.length === 0 ? (
              <p className="px-3 py-4 text-center text-xs text-text3">No notes match</p>
            ) : (
              filteredCustom.map(note => (
                <label key={note.id} className="flex cursor-pointer items-center gap-3 border-b border-border px-3 py-2 last:border-b-0 hover:bg-surface2">
                  <input
                    type="checkbox"
                    checked={selected.has(note.id)}
                    onChange={() => toggleCustom(note.id)}
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
          <p className="mt-1.5 text-right text-xs text-text3">{selected.size} selected</p>
        </div>
      )}

      <Divider />

      {/* Summary + Export */}
      <div className="space-y-3">
        <div className="flex items-center justify-between rounded-lg border border-border bg-surface2 px-4 py-2.5">
          <div className="flex items-center gap-2 text-sm text-text2">
            <Icon name="download" size={14} className="text-text3" />
            <span>
              {scope === 'all'    && <><strong className="text-text">{notes.length}</strong> notes · all</>}
              {scope === 'tags'   && (selectedTags.size === 0
                ? <span className="text-text3">No tags selected</span>
                : <><strong className="text-text">{notesToExport.length}</strong> notes matching {selectedTags.size} tag{selectedTags.size !== 1 ? 's' : ''}</>)}
              {scope === 'custom' && (selected.size === 0
                ? <span className="text-text3">No notes selected</span>
                : <><strong className="text-text">{notesToExport.length}</strong> note{notesToExport.length !== 1 ? 's' : ''} selected</>)}
            </span>
          </div>
          <span className="text-xs text-text3 uppercase tracking-wide">{format}</span>
        </div>

        <button
          type="button"
          disabled={!notesToExport.length || isExporting}
          onClick={() => void handleExport()}
          className="flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-text2 transition hover:border-accent/50 hover:text-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Icon name={isExporting ? 'loader-2' : 'download'} size={14} className={isExporting ? 'animate-spin' : ''} />
          {isExporting
            ? `Exporting ${progress!.done} / ${progress!.total}…`
            : `Export ${notesToExport.length || ''} note${notesToExport.length !== 1 ? 's' : ''}`}
        </button>

        {result && !isExporting && (
          <div className={`flex items-start gap-2 rounded-md border px-3 py-2 text-xs ${result.errors.length === 0 ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400'}`}>
            <Icon name={result.errors.length === 0 ? 'check-circle-2' : 'alert-triangle'} size={13} className="mt-0.5 shrink-0" />
            <div>
              <p>{result.exported} note{result.exported !== 1 ? 's' : ''} exported{result.errors.length > 0 ? ` · ${result.errors.length} failed` : ' successfully.'}</p>
              {result.errors.length > 0 && (
                <ul className="mt-1 space-y-0.5 opacity-80">{result.errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
