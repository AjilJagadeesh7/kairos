import { $prose } from '@milkdown/utils'
import { Plugin, PluginKey } from '@milkdown/prose/state'
import { Decoration, DecorationSet } from '@milkdown/prose/view'
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

// ── Types & constants ─────────────────────────────────────────────────────────

type ChartType = 'bar' | 'line' | 'pie' | 'radar' | 'doughnut'
interface ChartSpec { type: ChartType; title?: string; labels: string[]; datasets: Array<{ label?: string; data: number[]; color?: string }> }

const PALETTE = ['rgba(99,102,241,0.85)', 'rgba(139,92,246,0.85)', 'rgba(236,72,153,0.85)', 'rgba(14,165,233,0.85)', 'rgba(34,197,94,0.85)', 'rgba(249,115,22,0.85)']

// ── Parser ────────────────────────────────────────────────────────────────────

function parseChartYaml(raw: string): ChartSpec | null {
  try {
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
      if (inDatasets && current !== null) current[key] = val
      else top[key] = val
    }
    if (current) datasets.push(parseDataset(current))

    const labels = (top.labels ?? '').replace(/^\[|\]$/g, '').split(',').map(s => s.trim()).filter(Boolean)
    if (datasets.length === 0) return null
    return { type: (top.type ?? 'bar') as ChartType, title: top.title, labels, datasets }
  } catch { return null }
}

function parseDataset(d: Record<string, string>): ChartSpec['datasets'][0] {
  const data = (d.data ?? '').replace(/^\[|\]$/g, '').split(',').map(n => parseFloat(n.trim())).filter(n => !isNaN(n))
  return { label: d.label, data, color: d.color }
}

function buildData(spec: ChartSpec) {
  const isPolar = spec.type === 'pie' || spec.type === 'doughnut'
  return {
    labels: spec.labels,
    datasets: spec.datasets.map((ds, i) => {
      const c = ds.color ?? PALETTE[i % PALETTE.length]
      return {
        label: ds.label ?? `Series ${i + 1}`, data: ds.data,
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

// ── Widget (pure DOM — no React) ──────────────────────────────────────────────

type Entry = { dom: HTMLElement; canvas: HTMLCanvasElement; chart: Chart | null; raf: number; code: string }

function makeEntry(code: string): Entry {
  const dom = document.createElement('div')
  dom.contentEditable = 'false'
  dom.style.cssText = [
    'margin:10px 0', 'border-radius:10px', 'padding:16px',
    'height:300px', 'display:block', 'box-sizing:border-box',
    'border:1px solid rgb(var(--border))',
    'background:rgb(var(--surface-2))',
  ].join(';')

  const canvas = document.createElement('canvas')
  dom.appendChild(canvas)
  return { dom, canvas, chart: null, raf: 0, code }
}

function startChart(entry: Entry) {
  cancelAnimationFrame(entry.raf)
  entry.chart?.destroy()
  entry.chart = null

  const { dom, canvas, code } = entry
  const spec = parseChartYaml(code)

  if (!spec) {
    canvas.style.display = 'none'
    dom.style.color = 'rgb(239,68,68)'
    dom.style.fontSize = '12px'
    dom.append(' Chart: could not parse — check your syntax')
    return
  }

  canvas.style.display = 'block'
  const isPolar = spec.type === 'pie' || spec.type === 'doughnut'

  function tryInit() {
    if (!dom.isConnected) {
      entry.raf = requestAnimationFrame(tryInit)
      return
    }
    // clientWidth is 0 when the widget lands in an inline/collapsed ancestor.
    // Walk up to the first ancestor that has a real layout width.
    let measuredW = dom.clientWidth
    if (measuredW === 0) {
      let el: HTMLElement | null = dom.parentElement
      while (el && measuredW === 0) { measuredW = el.clientWidth; el = el.parentElement }
    }
    const w = measuredW > 32 ? measuredW - 32 : 568   // 2 × 16 px padding; 568 fallback
    const h = (dom.clientHeight || 300) - 32
    canvas.width  = Math.max(w, 1)
    canvas.height = Math.max(h, 1)

    try {
      entry.chart = new Chart(canvas, {
        type: spec!.type,
        data: buildData(spec!),
        options: {
          responsive: false, animation: false,
          plugins: {
            legend: { display: isPolar || spec!.type === 'radar', position: 'bottom', labels: { color: 'rgba(160,160,160,0.9)', font: { size: 11 } } },
            title: spec!.title ? { display: true, text: spec!.title, color: 'rgba(180,180,180,0.9)', font: { size: 13, weight: 'bold' } } : { display: false },
          },
          scales: isPolar || spec!.type === 'radar' ? {} : {
            x: { grid: { color: 'rgba(128,128,128,0.12)' }, ticks: { color: 'rgba(160,160,160,0.8)', font: { size: 11 } } },
            y: { grid: { color: 'rgba(128,128,128,0.12)' }, ticks: { color: 'rgba(160,160,160,0.8)', font: { size: 11 } }, beginAtZero: true },
          },
        },
      })
    } catch (e) { console.error('[ChartBlock] Chart.js init failed:', e) }
  }

  entry.raf = requestAnimationFrame(tryInit)
}

// ── ProseMirror plugin ────────────────────────────────────────────────────────

function buildDecorations(doc: Parameters<typeof DecorationSet.create>[0], map: Map<string, Entry>): DecorationSet {
  const decos: Decoration[] = []
  const active = new Set<string>()

  doc.descendants((node, pos) => {
    if (node.type.name !== 'code_block' || node.attrs.language !== 'chart') return
    const code = node.textContent ?? ''
    const key  = `chart:${pos}`
    active.add(key)

    decos.push(Decoration.node(pos, pos + node.nodeSize, { style: 'display:none' }))

    let entry = map.get(key)
    if (!entry) {
      entry = makeEntry(code)
      map.set(key, entry)
      startChart(entry)
    } else if (entry.code !== code) {
      entry.code = code
      startChart(entry)
    }
    decos.push(Decoration.widget(pos, entry.dom, { key, side: -1 }))
  })

  for (const [key, entry] of map) {
    if (!active.has(key)) {
      cancelAnimationFrame(entry.raf)
      entry.chart?.destroy()
      map.delete(key)
    }
  }
  return DecorationSet.create(doc, decos)
}

const pluginKey = new PluginKey<DecorationSet>('chart-code-block')

export const chartCodeBlockPlugin = $prose(() => {
  const map = new Map<string, Entry>()
  return new Plugin<DecorationSet>({
    key: pluginKey,
    state: {
      init:  (_, { doc }) => buildDecorations(doc, map),
      apply: (tr, old)    => tr.docChanged ? buildDecorations(tr.doc, map) : old,
    },
    props: { decorations(state) { return pluginKey.getState(state) } },
    view() { return { destroy() { map.forEach(e => { cancelAnimationFrame(e.raf); e.chart?.destroy() }); map.clear() } } },
  })
})
