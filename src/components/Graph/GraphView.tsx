import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import ForceGraph2D from 'react-force-graph-2d'
import { useLiveQuery } from 'dexie-react-hooks'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import { NotePreviewPopover } from '../common/NotePreviewPopover'
import { db } from '../../db/schema'
import { parseWikilinks } from '../../utils/wikilinks'
import { cosineSimilarity } from '../../utils/similarity'
import { Button } from '../ui/Button'

const GOLDEN_ANGLE = 137.508
function colorForIndex(i: number) {
  return `hsl(${((i * GOLDEN_ANGLE) % 360).toFixed(1)}, 72%, 62%)`
}

interface GNode {
  id: string; label: string; color: string; val: number; tags: string[]
  x?: number; y?: number; fx?: number; fy?: number
}
interface GLink {
  source: string | GNode; target: string | GNode; kind: 'wikilink' | 'semantic'
}
type Popover = { noteId: string; x: number; y: number }
type Props = { onBack?: () => void }
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FGRef = any

export function GraphView({ onBack }: Props): JSX.Element {
  const navigate = useNavigate()
  const notes    = useLiveQuery(() => db.notes.toArray(), [], [])

  const fgRef           = useRef<FGRef>(null)
  const canvasWrapRef   = useRef<HTMLDivElement>(null)
  const lastClickRef    = useRef<{ id: string; t: number } | null>(null)
  const selectedIdRef   = useRef<string | null>(null)
  const hoveredIdRef    = useRef<string | null>(null)

  const [rerenderKey, setRerenderKey] = useState(0)
  const [selectedId,  setSelectedId]  = useState<string | null>(null)
  const [popover,     setPopover]     = useState<Popover | null>(null)
  const [dims,        setDims]        = useState<{ w: number; h: number } | null>(null)
  const [bgColor,     setBgColor]     = useState('rgb(10,10,10)')
  const [textColor,   setTextColor]   = useState('rgba(255,255,255,0.75)')

  // Read theme CSS vars and watch for theme changes
  useEffect(() => {
    const readTheme = () => {
      const style = getComputedStyle(document.documentElement)
      const bg  = style.getPropertyValue('--bg').trim().split(/\s+/).map(Number)
      const txt = style.getPropertyValue('--text').trim().split(/\s+/).map(Number)
      if (bg.length  === 3) setBgColor(`rgb(${bg.join(',')})`)
      if (txt.length === 3) setTextColor(`rgba(${txt[0]},${txt[1]},${txt[2]},0.8)`)
    }
    readTheme()
    const obs = new MutationObserver(readTheme)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme'] })
    return () => obs.disconnect()
  }, [])

  // Measure the canvas container after layout so ForceGraph gets correct dimensions
  useEffect(() => {
    const el = canvasWrapRef.current
    if (!el) return
    const obs = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect
      if (width > 0 && height > 0) {
        setDims({ w: Math.round(width), h: Math.round(height) })
      }
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [])

  // keep ref in sync
  useEffect(() => { selectedIdRef.current = selectedId }, [selectedId])

  const { nodes, links } = useMemo(() => {
    if (!notes?.length) return { nodes: [] as GNode[], links: [] as GLink[] }

    const titleMap = new Map(notes.map(n => [n.title.trim().toLowerCase(), n.id]))
    const degree   = new Map<string, number>()
    const inc = (id: string) => degree.set(id, (degree.get(id) ?? 0) + 1)
    const seen  = new Set<string>()
    const links: GLink[] = []

    for (const note of notes) {
      for (const lnk of parseWikilinks(note.content)) {
        const tid = titleMap.get(lnk.trim().toLowerCase())
        if (!tid || tid === note.id) continue
        const key = [note.id, tid].sort().join('|')
        if (seen.has(key)) continue
        seen.add(key)
        links.push({ source: note.id, target: tid, kind: 'wikilink' })
        inc(note.id); inc(tid)
      }
    }
    for (let i = 0; i < notes.length; i++) {
      for (let j = i + 1; j < notes.length; j++) {
        const a = notes[i]; const b = notes[j]
        if (!a.embedding?.length || !b.embedding?.length) continue
        if (cosineSimilarity(a.embedding!, b.embedding!) > 0.75) {
          links.push({ source: a.id, target: b.id, kind: 'semantic' })
          inc(a.id); inc(b.id)
        }
      }
    }
    const nodes: GNode[] = notes.map((n, i) => ({
      id: n.id,
      label: n.title || 'Untitled',
      color: colorForIndex(i),
      val: Math.max(1, Math.min((degree.get(n.id) ?? 0) * 1.5 + 1, 14)),
      tags: n.tags ?? [],
    }))
    return { nodes, links }
  }, [notes, rerenderKey]) // eslint-disable-line react-hooks/exhaustive-deps

  const graphData = useMemo(() => ({ nodes, links }), [nodes, links])

  // Stable callback — reads selectedId from ref, never recreated
  const handleNodeClick = useCallback((node: GNode, event: MouseEvent) => {
    const now = Date.now()
    // double-click → navigate
    if (lastClickRef.current?.id === node.id && now - lastClickRef.current.t < 400) {
      navigate(`/notes/${node.id}`)
      onBack?.()
      return
    }
    lastClickRef.current = { id: node.id, t: now }
    // toggle
    if (selectedIdRef.current === node.id) {
      setSelectedId(null)
      setPopover(null)
      return
    }
    setSelectedId(node.id)
    setPopover({ noteId: node.id, x: event.clientX, y: event.clientY })
  }, [navigate, onBack]) // no selectedId dep — uses ref

  // Custom hit-test + hover tracking.
  // Uses a setTimeout so ForceGraph has time to mount its canvas after key change.
  useEffect(() => {
    if (!dims || nodes.length === 0) return
    let cleanup: (() => void) | undefined

    const attach = () => {
      const canvas = canvasWrapRef.current?.querySelector('canvas') as HTMLCanvasElement | null
      if (!canvas) return

      let startX = 0; let startY = 0
      const downHandler = (e: PointerEvent) => { startX = e.offsetX; startY = e.offsetY }

      const clickHandler = (e: PointerEvent) => {
        if (e.button !== 0) return // left button only
        if (Math.hypot(e.offsetX - startX, e.offsetY - startY) > 4) return
        const fg = fgRef.current
        if (!fg?.graph2ScreenCoords) return
        const cx = e.offsetX; const cy = e.offsetY
        let closest: GNode | null = null
        let minDist = Infinity
        for (const node of nodes) {
          if (node.x == null || node.y == null) continue
          const sc = fg.graph2ScreenCoords(node.x, node.y)
          const radius = 5 * Math.sqrt(node.val || 1) + 6
          const dist = Math.hypot(sc.x - cx, sc.y - cy)
          if (dist <= radius && dist < minDist) { minDist = dist; closest = node }
        }
        if (closest) {
          handleNodeClick(closest as GNode, e)
          e.stopPropagation()
        } else {
          setSelectedId(null); setPopover(null)
        }
      }

      const moveHandler = (e: MouseEvent) => {
        const fg = fgRef.current
        if (!fg?.graph2ScreenCoords) return
        const cx = e.offsetX; const cy = e.offsetY
        let hitNode: GNode | null = null
        for (const node of nodes) {
          if (node.x == null || node.y == null) continue
          const sc = fg.graph2ScreenCoords(node.x, node.y)
          if (Math.hypot(sc.x - cx, sc.y - cy) <= 5 * Math.sqrt(node.val || 1) + 6) { hitNode = node; break }
        }
        hoveredIdRef.current = hitNode?.id ?? null
        canvas.style.cursor = hitNode ? 'pointer' : 'grab'
      }

      const leaveHandler = () => { hoveredIdRef.current = null }

      canvas.addEventListener('pointerdown', downHandler)
      canvas.addEventListener('pointerup', clickHandler)
      canvas.addEventListener('mousemove', moveHandler)
      canvas.addEventListener('mouseleave', leaveHandler)
      cleanup = () => {
        canvas.removeEventListener('pointerdown', downHandler)
        canvas.removeEventListener('pointerup', clickHandler)
        canvas.removeEventListener('mousemove', moveHandler)
        canvas.removeEventListener('mouseleave', leaveHandler)
      }
    }

    const t = setTimeout(attach, 80)
    return () => { clearTimeout(t); cleanup?.() }
  }, [dims, nodes, handleNodeClick])

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const handleNodeHover = useCallback((_n: GNode | null) => { /* hover handled natively */ }, [])

  // Draw label only when this node is hovered — reads hoveredIdRef (no re-render needed)
  const nodeCanvasObject = useCallback((node: GNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
    if (hoveredIdRef.current !== node.id) return
    const label = node.label.length > 22 ? node.label.slice(0, 20) + '…' : node.label
    const fontSize = Math.max(6, 8 / globalScale)
    ctx.font = `400 ${fontSize}px Manrope, sans-serif`
    ctx.fillStyle = textColor.replace(/,\s*[\d.]+\)$/, ', 0.55)')
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    const nodeRadius = 5 * Math.sqrt(node.val || 1)
    ctx.fillText(label, node.x ?? 0, (node.y ?? 0) + nodeRadius + 2 / globalScale)
  }, [textColor])

  const handleNodeDragEnd = useCallback((node: GNode) => {
    node.fx = node.x; node.fy = node.y
  }, [])

  const wikilinkCount = links.filter(l => l.kind === 'wikilink').length
  const semanticCount = links.filter(l => l.kind === 'semantic').length

  return (
    <div className="relative flex h-[calc(100vh-65px)] flex-col" style={{ background: bgColor }}>

      {/* Toolbar */}
      <div className="flex shrink-0 items-center gap-3 px-4 py-2.5"
        style={{ borderBottom: '1px solid rgb(var(--border))', background: 'rgb(var(--surface-2))' }}>
        <Button variant="ghost" size="xs" onClick={() => onBack ? onBack() : navigate(-1)} className="inline-flex items-center gap-1.5 text-[rgb(var(--text-2))] hover:text-[rgb(var(--text))]">
          <ArrowLeft size={13} /> Back
        </Button>
        <div className="h-4 w-px bg-white/10" />
        <span className="text-sm font-bold tracking-tight text-[rgb(var(--text))]">Knowledge Graph</span>
        <span className="rounded-full px-2 py-0.5 text-[11px]"
          style={{ background: 'rgb(var(--surface-3))', color: 'rgb(var(--text-3))' }}>
          {nodes.length} notes · {links.length} links
        </span>
        <div className="ml-auto flex items-center gap-4">
          <div className="hidden items-center gap-4 text-xs sm:flex" style={{ color: 'rgb(var(--text-2))' }}>
            <span className="flex items-center gap-1.5">
              <svg width="20" height="8" viewBox="0 0 20 8" fill="none">
                <line x1="0" y1="4" x2="20" y2="4" stroke="#2dd4bf" strokeWidth="2" strokeDasharray="5 3" />
                <polygon points="16,1.5 20,4 16,6.5" fill="#2dd4bf" />
              </svg>
              Wikilink <span style={{ color: 'rgb(var(--text-3))' }}>{wikilinkCount}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <svg width="20" height="8" viewBox="0 0 20 8" fill="none">
                <line x1="0" y1="4" x2="20" y2="4" stroke="#818cf8" strokeWidth="1.5" strokeDasharray="2 2" />
              </svg>
              Semantic <span style={{ color: 'rgb(var(--text-3))' }}>{semanticCount}</span>
            </span>
          </div>
          <button title="Re-layout"
            onClick={() => { setSelectedId(null); setPopover(null); setRerenderKey(k => k + 1) }}
            className="rounded-md p-1.5 text-[rgb(var(--text-3))] transition hover:bg-[rgb(var(--surface-3))] hover:text-[rgb(var(--text))]">
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* Canvas — only mount when dims AND nodes are ready, so ForceGraph inits with correct data */}
      <div ref={canvasWrapRef} className="flex-1" style={{ overflow: 'hidden' }}>
        {dims && nodes.length > 0 && <ForceGraph2D
          key={`${rerenderKey}-${dims.w}-${dims.h}-${nodes.length}`}
          ref={fgRef}
          graphData={graphData}
          backgroundColor={bgColor}
          width={dims.w}
          height={dims.h}
          nodeColor={(node: GNode) => node.id === selectedId ? '#ffffff' : node.color}
          nodeVal={(node: GNode) => node.val}
          nodeLabel={(node: GNode) => node.label}
          nodeRelSize={5}
          nodeCanvasObjectMode={() => 'after'}
          nodeCanvasObject={nodeCanvasObject}
          linkColor={(lnk: GLink) => lnk.kind === 'wikilink' ? 'rgba(45,212,191,0.4)' : 'rgba(129,140,248,0.25)'}
          linkWidth={(lnk: GLink) => lnk.kind === 'wikilink' ? 1.2 : 0.6}
          linkDirectionalArrowLength={(l: GLink) => l.kind === 'wikilink' ? 5 : 0}
          linkDirectionalArrowRelPos={1}
          linkDirectionalParticles={(l: GLink) => l.kind === 'wikilink' ? 2 : 0}
          linkDirectionalParticleSpeed={0.004}
          linkDirectionalParticleWidth={1.5}
          linkDirectionalParticleColor={() => '#2dd4bf'}
          d3AlphaDecay={0.035}
          d3VelocityDecay={0.6}
          cooldownTicks={200}
          warmupTicks={60}
          enableNodeDrag
          onNodeHover={handleNodeHover}
          onNodeDragEnd={handleNodeDragEnd}
        />}
      </div>

      {/* Hint */}
      {nodes.length > 0 && !popover && (
        <div className="pointer-events-none absolute bottom-5 left-1/2 z-10 -translate-x-1/2 rounded-full px-3 py-1 text-[11px]"
          style={{ background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.25)', border: '1px solid rgba(255,255,255,0.06)' }}>
          Click node · Double-click to open · Drag to move
        </div>
      )}

      {/* Empty state */}
      {nodes.length === 0 && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm" style={{ color: 'rgba(255,255,255,0.25)' }}>
          No notes yet. Create some notes to see the graph.
        </div>
      )}

      {/* Popover */}
      {popover && (
        <NotePreviewPopover
          noteId={popover.noteId}
          x={popover.x}
          y={popover.y}
          onNavigate={() => { navigate(`/notes/${popover.noteId}`); onBack?.() }}
          onClose={() => { setSelectedId(null); setPopover(null) }}
        />
      )}
    </div>
  )
}
