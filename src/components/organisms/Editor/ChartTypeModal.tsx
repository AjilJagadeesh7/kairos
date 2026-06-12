import { useState } from 'react'
import { ModalShell } from '../../molecules/ModalShell'
import { Button } from '../../atoms/Button'
import { IconButton } from '../../atoms/IconButton'
import { Icon } from '../../../icons/Icon'

// ── Types ─────────────────────────────────────────────────────────────────────

type ChartType = 'bar' | 'line' | 'pie' | 'doughnut' | 'radar'

interface Dataset {
  label: string
  values: string
  color: string
}

// ── Chart type definitions ────────────────────────────────────────────────────

const CHART_TYPES: { type: ChartType; label: string; icon: React.ReactNode }[] = [
  {
    type: 'bar', label: 'Bar',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/><line x1="2" y1="20" x2="22" y2="20"/></svg>,
  },
  {
    type: 'line', label: 'Line',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  },
  {
    type: 'pie', label: 'Pie',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/></svg>,
  },
  {
    type: 'doughnut', label: 'Doughnut',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/></svg>,
  },
  {
    type: 'radar', label: 'Radar',
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5"><polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"/><line x1="12" y1="2" x2="12" y2="22"/><line x1="2" y1="8.5" x2="22" y2="15.5"/><line x1="22" y1="8.5" x2="2" y2="15.5"/></svg>,
  },
]

const DEFAULT_COLORS = ['#6366f1', '#ec4899', '#0ea5e9', '#22c55e', '#f97316', '#a855f7']

// ── Template builder ──────────────────────────────────────────────────────────

export function buildChartTemplate(type: string): string {
  return buildFromForm(type as ChartType, '', 'Jan, Feb, Mar, Apr, May', [
    { label: 'Series 1', values: '10, 20, 15, 25, 18', color: '#6366f1' },
  ])
}

function buildFromForm(type: ChartType, title: string, labels: string, datasets: Dataset[]): string {
  const lines: string[] = [`type: ${type}`]
  if (title.trim()) lines.push(`title: ${title.trim()}`)
  lines.push(`labels: [${labels}]`)
  lines.push('datasets:')
  for (const ds of datasets) {
    lines.push(`  - label: ${ds.label || 'Series'}`)
    lines.push(`    data: [${ds.values}]`)
    if (ds.color) lines.push(`    color: "${ds.color}"`)
  }
  return lines.join('\n')
}

// ── Sub-components ────────────────────────────────────────────────────────────

function TypeTile({ type: _type, label, icon, selected, onClick }: {
  type: ChartType; label: string; icon: React.ReactNode; selected: boolean; onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex flex-col items-center gap-1.5 rounded-lg border px-3 py-3 transition ${
        selected
          ? 'border-accent bg-accent/10 text-accent'
          : 'border-border bg-surface2 text-text2 hover:border-accent/50 hover:text-accent'
      }`}
    >
      {icon}
      <span className="text-[11px] font-medium">{label}</span>
    </button>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface ChartTypeModalProps {
  onInsert: (template: string) => void
  onClose: () => void
}

export function ChartTypeModal({ onInsert, onClose }: ChartTypeModalProps) {
  const [step, setStep] = useState<'type' | 'data'>('type')
  const [chartType, setChartType] = useState<ChartType>('bar')
  const [chartTitle, setChartTitle] = useState('')
  const [labels, setLabels] = useState('Jan, Feb, Mar, Apr, May')
  const [datasets, setDatasets] = useState<Dataset[]>([
    { label: 'Series 1', values: '10, 20, 15, 25, 18', color: '#6366f1' },
  ])

  const selectedMeta = CHART_TYPES.find(c => c.type === chartType)!

  function addDataset() {
    const color = DEFAULT_COLORS[datasets.length % DEFAULT_COLORS.length]
    setDatasets(prev => [...prev, { label: `Series ${prev.length + 1}`, values: '', color }])
  }

  function updateDataset(i: number, patch: Partial<Dataset>) {
    setDatasets(prev => prev.map((d, idx) => idx === i ? { ...d, ...patch } : d))
  }

  function removeDataset(i: number) {
    setDatasets(prev => prev.filter((_, idx) => idx !== i))
  }

  function handleInsert() {
    onInsert(buildFromForm(chartType, chartTitle, labels, datasets))
    onClose()
  }

  // ── Step 1: choose type ────────────────────────────────────────────────────
  if (step === 'type') {
    return (
      <ModalShell onClose={onClose} maxWidth="max-w-sm">
        <div className="p-5">
          <p className="mb-1 text-sm font-semibold text-text">Insert Chart</p>
          <p className="mb-4 text-xs text-text3">Choose a chart type.</p>
          <div className="grid grid-cols-5 gap-2">
            {CHART_TYPES.map(c => (
              <TypeTile key={c.type} {...c} selected={chartType === c.type}
                onClick={() => { setChartType(c.type); setStep('data') }} />
            ))}
          </div>
        </div>
      </ModalShell>
    )
  }

  // ── Step 2: enter data ─────────────────────────────────────────────────────
  return (
    <ModalShell onClose={onClose} maxWidth="max-w-md">
      <div className="p-5">
        {/* Header with type switcher */}
        <div className="mb-4 flex items-center gap-2">
          <Button variant="hollow" size="xs" onClick={() => setStep('type')}>
            {selectedMeta.icon}
            {selectedMeta.label}
            <Icon name="chevron-down" size={11} className="text-text3" />
          </Button>
          <span className="text-sm font-semibold text-text">Chart data</span>
        </div>

        {/* Title */}
        <div className="mb-3">
          <label className="mb-1 block text-xs font-medium text-text3">Title (optional)</label>
          <input
            type="text"
            value={chartTitle}
            onChange={e => setChartTitle(e.target.value)}
            placeholder="e.g. Monthly Sales"
            className="w-full rounded-md border border-border bg-surface2 px-3 py-1.5 text-sm text-text outline-none placeholder:text-text3 focus:border-accent/60"
          />
        </div>

        {/* Labels */}
        <div className="mb-4">
          <label className="mb-1 block text-xs font-medium text-text3">Labels <span className="font-normal">(comma-separated)</span></label>
          <input
            type="text"
            value={labels}
            onChange={e => setLabels(e.target.value)}
            placeholder="Jan, Feb, Mar, Apr, May"
            className="w-full rounded-md border border-border bg-surface2 px-3 py-1.5 text-sm text-text outline-none placeholder:text-text3 focus:border-accent/60"
          />
        </div>

        {/* Datasets */}
        <div className="mb-3">
          <label className="mb-2 block text-xs font-medium text-text3">Data series</label>
          <div className="space-y-2">
            {datasets.map((ds, i) => (
              <div key={i} className="flex items-center gap-2">
                {/* Series name */}
                <input
                  type="text"
                  value={ds.label}
                  onChange={e => updateDataset(i, { label: e.target.value })}
                  placeholder="Name"
                  className="w-24 shrink-0 rounded-md border border-border bg-surface2 px-2 py-1.5 text-xs text-text outline-none focus:border-accent/60"
                />
                {/* Values */}
                <input
                  type="text"
                  value={ds.values}
                  onChange={e => updateDataset(i, { values: e.target.value })}
                  placeholder="10, 20, 15, 25, 18"
                  className="min-w-0 flex-1 rounded-md border border-border bg-surface2 px-2 py-1.5 text-xs text-text outline-none focus:border-accent/60"
                />
                {/* Color */}
                <input
                  type="color"
                  value={ds.color}
                  onChange={e => updateDataset(i, { color: e.target.value })}
                  title="Series colour"
                  className="h-7 w-7 shrink-0 cursor-pointer rounded-md border border-border bg-surface2 p-0.5"
                />
                {/* Remove */}
                {datasets.length > 1 && (
                  <IconButton icon="x" label="Remove series" size="xs" onClick={() => removeDataset(i)} />
                )}
              </div>
            ))}
          </div>

          <Button variant="link" size="xs" className="mt-2" onClick={addDataset}>
            <Icon name="plus" size={12} /> Add series
          </Button>
        </div>

        {/* Footer */}
        <div className="mt-4 flex justify-end gap-2 border-t border-border pt-4">
          <Button variant="hollow" size="md" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="submit" size="md" onClick={handleInsert}>
            Insert Chart
          </Button>
        </div>
      </div>
    </ModalShell>
  )
}
