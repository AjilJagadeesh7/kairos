import { useEffect, useRef } from 'react'
import {
  Chart,
  BarController, LineController, PieController, DoughnutController, RadarController,
  CategoryScale, LinearScale, RadialLinearScale,
  BarElement, LineElement, PointElement, ArcElement,
  Title, Tooltip, Legend, Filler,
} from 'chart.js'

Chart.register(
  BarController, LineController, PieController, DoughnutController, RadarController,
  CategoryScale, LinearScale, RadialLinearScale,
  BarElement, LineElement, PointElement, ArcElement,
  Title, Tooltip, Legend, Filler,
)

type ChartType = 'bar' | 'line' | 'pie' | 'radar' | 'doughnut'

interface ChartSpec {
  type: ChartType
  title?: string
  labels: string[]
  datasets: Array<{ label?: string; data: number[]; color?: string }>
}

const PALETTE = [
  'rgba(99,102,241,0.85)',
  'rgba(139,92,246,0.85)',
  'rgba(236,72,153,0.85)',
  'rgba(14,165,233,0.85)',
  'rgba(34,197,94,0.85)',
  'rgba(249,115,22,0.85)',
]

// ── Parser ────────────────────────────────────────────────────────────────────
// Normalises the code to newline form first, so it works whether the user
// typed the block with real newlines or with literal \n in a compact source.

function parseChartYaml(raw: string): ChartSpec | null {
  try {
    // Normalise: if the whole block is on one line, split on key boundaries
    const text = raw.includes('\n') ? raw : raw
      .replace(/\b(type|title|labels|datasets|label|data|color):/g, '\n$1:')
      .replace(/^\s*-\s+/gm, '\n  - ')

    const lines = text.split('\n').map(l => l.trimEnd())

    const top: Record<string, string> = {}
    const datasets: ChartSpec['datasets'] = []
    let inDatasets = false
    let current: Record<string, string> | null = null

    for (const line of lines) {
      if (!line.trim()) continue

      if (line.trimStart().startsWith('- ')) {
        inDatasets = true
        if (current) datasets.push(parseDataset(current))
        current = {}
        const rest = line.trimStart().slice(2)
        const ci = rest.indexOf(':')
        if (ci >= 0) current[rest.slice(0, ci).trim()] = rest.slice(ci + 1).trim().replace(/^"|"$/g, '')
        continue
      }

      const ci = line.indexOf(':')
      if (ci < 0) continue
      const key = line.slice(0, ci).trim()
      const val = line.slice(ci + 1).trim().replace(/^"|"$/g, '')

      if (key === 'datasets') { inDatasets = true; continue }

      if (inDatasets && current !== null) {
        current[key] = val
      } else {
        top[key] = val
      }
    }
    if (current) datasets.push(parseDataset(current))

    const labels = (top.labels ?? '')
      .replace(/^\[|\]$/g, '')
      .split(',')
      .map(s => s.trim())
      .filter(Boolean)

    if (datasets.length === 0) return null

    return {
      type: (top.type ?? 'bar') as ChartType,
      title: top.title,
      labels,
      datasets,
    }
  } catch {
    return null
  }
}

function parseDataset(d: Record<string, string>): ChartSpec['datasets'][0] {
  const raw = (d.data ?? '').replace(/^\[|\]$/g, '')
  const data = raw.split(',').map(n => parseFloat(n.trim())).filter(n => !isNaN(n))
  return { label: d.label, data, color: d.color }
}

// ── Chart.js data builder ─────────────────────────────────────────────────────

function buildData(spec: ChartSpec) {
  const isPolar = spec.type === 'pie' || spec.type === 'doughnut'
  return {
    labels: spec.labels,
    datasets: spec.datasets.map((ds, i) => {
      const c = ds.color ?? PALETTE[i % PALETTE.length]
      return {
        label: ds.label ?? `Series ${i + 1}`,
        data: ds.data,
        backgroundColor: isPolar ? spec.labels.map((_, j) => PALETTE[j % PALETTE.length]) : c,
        borderColor: isPolar ? 'transparent' : c,
        borderRadius: spec.type === 'bar' ? 5 : 0,
        tension: spec.type === 'line' ? 0.35 : 0,
        fill: spec.type === 'line',
        pointRadius: spec.type === 'line' ? 3 : undefined,
        pointBackgroundColor: spec.type === 'line' ? c : undefined,
      }
    }),
  }
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ChartBlock({ code }: { code: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const chartRef  = useRef<Chart | null>(null)

  useEffect(() => {
    const spec = parseChartYaml(code)
    if (!spec || !canvasRef.current) return

    const canvas  = canvasRef.current
    const isPolar = spec.type === 'pie' || spec.type === 'doughnut'
    let raf = 0

    chartRef.current?.destroy()
    chartRef.current = null

    // ProseMirror widget decorations may render into a detached or not-yet-laid-out
    // DOM node. Poll via rAF until the container has real pixel dimensions, then size
    // the canvas drawing surface explicitly so Chart.js has something to paint on.
    function tryInit() {
      const container = canvas.parentElement
      if (!canvas.isConnected || !container || container.clientWidth === 0) {
        raf = requestAnimationFrame(tryInit)
        return
      }
      // Stamp actual pixel dimensions onto the canvas before Chart.js reads them
      canvas.width  = container.clientWidth
      canvas.height = container.clientHeight || 268
      try {
        chartRef.current = new Chart(canvas, {
          type: spec!.type,
          data: buildData(spec!),
          options: {
            responsive: false,
            animation: false,
            plugins: {
              legend: { display: isPolar || spec!.type === 'radar', position: 'bottom', labels: { color: 'rgba(160,160,160,0.9)', font: { size: 11 } } },
              title: spec!.title
                ? { display: true, text: spec!.title, color: 'rgba(180,180,180,0.9)', font: { size: 13, weight: '600' as const } }
                : { display: false },
            },
            scales: isPolar || spec!.type === 'radar' ? {} : {
              x: { grid: { color: 'rgba(128,128,128,0.12)' }, ticks: { color: 'rgba(160,160,160,0.8)', font: { size: 11 } } },
              y: { grid: { color: 'rgba(128,128,128,0.12)' }, ticks: { color: 'rgba(160,160,160,0.8)', font: { size: 11 } }, beginAtZero: true },
            },
          },
        })
      } catch (e) {
        console.error('[ChartBlock] Chart.js init failed:', e)
      }
    }

    raf = requestAnimationFrame(tryInit)
    return () => { cancelAnimationFrame(raf); chartRef.current?.destroy(); chartRef.current = null }
  }, [code])

  const spec = parseChartYaml(code)
  if (!spec) {
    return (
      <div
        contentEditable={false}
        style={{
          padding: '10px 14px', borderRadius: 8, margin: '8px 0',
          border: '1px solid rgba(239,68,68,0.35)',
          background: 'rgba(239,68,68,0.06)',
          color: 'rgb(239,68,68)', fontSize: 12,
        }}
      >
        Chart: could not parse — check your syntax
      </div>
    )
  }

  return (
    <div
      contentEditable={false}
      style={{
        margin: '10px 0', borderRadius: 10, padding: '16px', height: 300,
        border: '1px solid rgb(var(--border))',
        background: 'rgb(var(--surface-2))',
      }}
    >
      <canvas ref={canvasRef} style={{ display: 'block' }} />
    </div>
  )
}
