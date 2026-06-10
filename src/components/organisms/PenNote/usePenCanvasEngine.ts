import { useCallback, useEffect, useRef, useState } from 'react'
import type { PenStroke, PenTool } from '../../../types'
import { AUTO_INK, HIGHLIGHTER_COLORS, PEN_SIZES, HIGHLIGHTER_SIZE } from '../../../types'
import { drawStroke } from './inkRender'
import { strokeHitByEraser, strokeInsideLasso } from './penCanvasGeometry'

const ERASER_RADIUS = 14
const GROW_MARGIN = 400   // grow the page when ink nears the bottom

interface Params {
  canvasRef: React.RefObject<HTMLCanvasElement>
  strokes: PenStroke[]
  onChange: (strokes: PenStroke[]) => void
  pageWidth: number
  height: number
  onGrow: (height: number) => void
}

export interface PenCanvasEngine {
  tool: PenTool
  setTool: (t: PenTool) => void
  color: string
  setColor: (c: string) => void
  size: number
  setSize: (s: number) => void
  allowFinger: boolean
  setAllowFinger: (v: boolean) => void
  canUndo: boolean
  canRedo: boolean
  undo: () => void
  redo: () => void
  hasSelection: boolean
  deleteSelection: () => void
  /** Stroke ids currently selected by the lasso (for to-text / actions). */
  selectedIds: Set<string>
}

/**
 * Owns the pen-note canvas: tool state, undo/redo, and all pointer input +
 * imperative rendering. Committed strokes are cached in an offscreen buffer so
 * each pointermove only blits the buffer + the live stroke (low latency even on
 * a long page). The visible canvas draws in content-space (CSS px == content
 * px); the backing store is scaled by devicePixelRatio for crisp ink.
 */
export function usePenCanvasEngine({ canvasRef, strokes, onChange, pageWidth, height, onGrow }: Params): PenCanvasEngine {
  const [tool, setTool] = useState<PenTool>('pen')
  const [penColor, setPenColor] = useState<string>(AUTO_INK)
  const [penSize, setPenSize] = useState<number>(PEN_SIZES[1])
  const [hlColor, setHlColor] = useState<string>(HIGHLIGHTER_COLORS[0])
  const [allowFinger, setAllowFinger] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [undoLen, setUndoLen] = useState(0)
  const [redoLen, setRedoLen] = useState(0)

  const strokesRef = useRef(strokes)
  const offscreen = useRef<HTMLCanvasElement | null>(null)
  const live = useRef<PenStroke | null>(null)
  const lasso = useRef<number[][] | null>(null)
  const dragFrom = useRef<{ x: number; y: number } | null>(null)
  const dragMoved = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 })
  const undoStack = useRef<PenStroke[][]>([])
  const redoStack = useRef<PenStroke[][]>([])
  const selectedRef = useRef(selectedIds)
  const toolRef = useRef(tool)
  const allowFingerRef = useRef(allowFinger)

  // Mirror latest state onto refs for the imperative pointer/render handlers.
  useEffect(() => { strokesRef.current = strokes }, [strokes])
  useEffect(() => { selectedRef.current = selectedIds }, [selectedIds])
  useEffect(() => { toolRef.current = tool }, [tool])
  useEffect(() => { allowFingerRef.current = allowFinger }, [allowFinger])

  const color = tool === 'highlighter' ? hlColor : penColor
  const size = tool === 'highlighter' ? HIGHLIGHTER_SIZE : penSize
  const setColor = useCallback((c: string) => {
    if (toolRef.current === 'highlighter') setHlColor(c); else setPenColor(c)
  }, [])
  const setSize = useCallback((s: number) => setPenSize(s), [])
  const syncHist = useCallback(() => {
    setUndoLen(undoStack.current.length)
    setRedoLen(redoStack.current.length)
  }, [])

  const dpr = () => window.devicePixelRatio || 1

  // Theme text color for AUTO_INK strokes (canvas inherits `color` from CSS).
  const autoColor = useCallback(() => {
    const c = canvasRef.current
    return c ? getComputedStyle(c).color || '#111827' : '#111827'
  }, [canvasRef])

  const renderCommitted = useCallback(() => {
    const buf = offscreen.current
    if (!buf) return
    const ctx = buf.getContext('2d')!
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, buf.width, buf.height)
    ctx.scale(dpr(), dpr())
    const ink = autoColor()
    const sel = selectedRef.current
    const { dx, dy } = dragMoved.current
    for (const s of strokesRef.current) {
      if (sel.has(s.id) && (dx || dy)) {
        drawStroke(ctx, { ...s, points: s.points.map(([x, y, p]) => [x + dx, y + dy, p]) }, ink)
      } else {
        drawStroke(ctx, s, ink)
      }
    }
  }, [autoColor])

  const paint = useCallback(() => {
    const canvas = canvasRef.current
    const buf = offscreen.current
    if (!canvas || !buf) return
    const ctx = canvas.getContext('2d')!
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(buf, 0, 0)
    ctx.scale(dpr(), dpr())

    if (live.current) drawStroke(ctx, live.current, autoColor())

    if (lasso.current && lasso.current.length > 1) {
      ctx.save()
      ctx.strokeStyle = 'rgba(99,102,241,0.9)'
      ctx.setLineDash([6, 4])
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.moveTo(lasso.current[0][0], lasso.current[0][1])
      for (const [x, y] of lasso.current.slice(1)) ctx.lineTo(x, y)
      ctx.stroke()
      ctx.restore()
    }
  }, [canvasRef, autoColor])

  // Size the canvas + offscreen buffer to page dimensions × DPR.
  const sizeCanvases = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    if (!offscreen.current) offscreen.current = document.createElement('canvas')
    const buf = offscreen.current
    const w = Math.round(pageWidth * dpr())
    const h = Math.round(height * dpr())
    for (const c of [canvas, buf]) {
      if (c.width !== w) c.width = w
      if (c.height !== h) c.height = h
    }
    canvas.style.width = `${pageWidth}px`
    canvas.style.height = `${height}px`
    renderCommitted()
    paint()
  }, [canvasRef, pageWidth, height, renderCommitted, paint])

  useEffect(() => { sizeCanvases() }, [sizeCanvases])
  useEffect(() => { renderCommitted(); paint() }, [strokes, selectedIds, renderCommitted, paint])

  const pushUndo = useCallback(() => {
    undoStack.current.push(strokesRef.current)
    if (undoStack.current.length > 100) undoStack.current.shift()
    redoStack.current = []
  }, [])

  const commit = useCallback((next: PenStroke[]) => {
    pushUndo()
    onChange(next)
    syncHist()
  }, [onChange, pushUndo, syncHist])

  const maybeGrow = useCallback((maxY: number) => {
    if (maxY > height - GROW_MARGIN) onGrow(maxY + GROW_MARGIN)
  }, [height, onGrow])

  // ── Pointer input ────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const point = (e: PointerEvent): [number, number, number] => {
      const r = canvas.getBoundingClientRect()
      return [e.clientX - r.left, e.clientY - r.top, e.pressure > 0 ? e.pressure : 0.5]
    }
    const isDrawer = (e: PointerEvent) =>
      e.pointerType === 'pen' || e.pointerType === 'mouse' || (e.pointerType === 'touch' && allowFingerRef.current)

    const onDown = (e: PointerEvent) => {
      if (!isDrawer(e)) return       // let touch scroll the page
      e.preventDefault()
      canvas.setPointerCapture(e.pointerId)
      const p = point(e)
      const t = toolRef.current

      if (t === 'eraser') { eraseAt(p[0], p[1]); return }
      if (t === 'lasso') {
        // If pressing inside an existing selection, start a drag; else new lasso.
        if (selectedRef.current.size && hitSelection(p[0], p[1])) {
          dragFrom.current = { x: p[0], y: p[1] }
        } else {
          setSelectedIds(new Set())
          lasso.current = [[p[0], p[1]]]
        }
        return
      }
      live.current = { id: crypto.randomUUID(), tool: t, color: t === 'highlighter' ? hlColor : penColor, size: t === 'highlighter' ? HIGHLIGHTER_SIZE : penSize, points: [p] }
      paint()
    }

    const onMove = (e: PointerEvent) => {
      const t = toolRef.current
      if (live.current) {
        for (const ev of (e.getCoalescedEvents?.() ?? [e])) live.current.points.push(point(ev))
        paint()
      } else if (t === 'eraser' && (e.buttons & 1 || e.pointerType === 'touch')) {
        const p = point(e); eraseAt(p[0], p[1])
      } else if (lasso.current) {
        lasso.current.push([point(e)[0], point(e)[1]]); paint()
      } else if (dragFrom.current) {
        const p = point(e)
        dragMoved.current = { dx: p[0] - dragFrom.current.x, dy: p[1] - dragFrom.current.y }
        renderCommitted(); paint()
      }
    }

    const onUp = () => {
      if (live.current) {
        const s = live.current; live.current = null
        const maxY = Math.max(...s.points.map(p => p[1]))
        commit([...strokesRef.current, s])
        maybeGrow(maxY)
      } else if (lasso.current) {
        const poly = lasso.current; lasso.current = null
        const ids = new Set(strokesRef.current.filter(s => strokeInsideLasso(s, poly)).map(s => s.id))
        setSelectedIds(ids); paint()
      } else if (dragFrom.current) {
        dragFrom.current = null
        const { dx, dy } = dragMoved.current
        dragMoved.current = { dx: 0, dy: 0 }
        if (dx || dy) {
          const sel = selectedRef.current
          commit(strokesRef.current.map(s => sel.has(s.id)
            ? { ...s, points: s.points.map(([x, y, p]) => [x + dx, y + dy, p] as [number, number, number]) }
            : s))
        }
      }
    }

    const eraseAt = (x: number, y: number) => {
      const keep = strokesRef.current.filter(s => !strokeHitByEraser(s, x, y, ERASER_RADIUS))
      if (keep.length !== strokesRef.current.length) commit(keep)
    }
    const hitSelection = (x: number, y: number) => {
      const sel = selectedRef.current
      return strokesRef.current.some(s => sel.has(s.id) && strokeHitByEraser(s, x, y, 24))
    }

    canvas.addEventListener('pointerdown', onDown)
    canvas.addEventListener('pointermove', onMove)
    canvas.addEventListener('pointerup', onUp)
    canvas.addEventListener('pointercancel', onUp)
    return () => {
      canvas.removeEventListener('pointerdown', onDown)
      canvas.removeEventListener('pointermove', onMove)
      canvas.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('pointercancel', onUp)
    }
  }, [canvasRef, commit, paint, renderCommitted, maybeGrow, hlColor, penColor, penSize])

  const undo = useCallback(() => {
    const prev = undoStack.current.pop()
    if (!prev) return
    redoStack.current.push(strokesRef.current)
    onChange(prev); setSelectedIds(new Set()); syncHist()
  }, [onChange, syncHist])

  const redo = useCallback(() => {
    const next = redoStack.current.pop()
    if (!next) return
    undoStack.current.push(strokesRef.current)
    onChange(next); syncHist()
  }, [onChange, syncHist])

  const deleteSelection = useCallback(() => {
    if (!selectedRef.current.size) return
    commit(strokesRef.current.filter(s => !selectedRef.current.has(s.id)))
    setSelectedIds(new Set())
  }, [commit])

  return {
    tool, setTool, color, setColor, size, setSize,
    allowFinger, setAllowFinger,
    canUndo: undoLen > 0,
    canRedo: redoLen > 0,
    undo, redo,
    hasSelection: selectedIds.size > 0,
    deleteSelection,
    selectedIds,
  }
}
