import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ReactFlow,
  ReactFlowProvider,
  Background,
  Controls,
  MiniMap,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  BackgroundVariant,
  ConnectionMode,
  type Node,
  type Edge,
  type Connection,
  type NodeChange,
  type EdgeChange,
  useReactFlow,
} from '@xyflow/react'
import { useCanvasStore } from '../../../store/useCanvasStore'
import { useAppStore } from '../../../store/useAppStore'
import { Icon } from '../../../icons/Icon'
import { TextNode } from './nodes/TextNode'
import { NoteNode } from './nodes/NoteNode'
import { WebNode } from './nodes/WebNode'
import type { Canvas, CanvasNode, CanvasEdge } from '../../../types'

// ─── Detect dark vs light from CSS --bg variable (matches app theme) ─────────

function getBgLuminance() {
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()
  const parts = raw.split(' ').map(Number)
  return parts.length === 3 ? (parts[0] + parts[1] + parts[2]) / 3 : 0
}

function useColorMode(): 'dark' | 'light' {
  const [isDark, setIsDark] = useState(() => getBgLuminance() < 128)
  useEffect(() => {
    const obs = new MutationObserver(() => setIsDark(getBgLuminance() < 128))
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme', 'style'] })
    return () => obs.disconnect()
  }, [])
  return isDark ? 'dark' : 'light'
}

// ─── Node types (stable reference — must be outside component) ────────────────

const NODE_TYPES = { text: TextNode, note: NoteNode, web: WebNode } as const

// ─── Note picker modal ────────────────────────────────────────────────────────

function NotePickerModal({ onPick, onClose }: { onPick: (noteId: string, title: string) => void; onClose: () => void }) {
  const notes = useAppStore(s => s.notes)
  const [query, setQuery] = useState('')
  const filtered = useMemo(() => {
    const q = query.toLowerCase()
    return q ? notes.filter(n => (n.title || 'Untitled').toLowerCase().includes(q)) : notes
  }, [notes, query])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onMouseDown={onClose}>
      <div className="w-[400px] overflow-hidden rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] shadow-2xl" onMouseDown={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 border-b border-[rgb(var(--border))] px-3 py-2">
          <Icon name="search" size={14} className="text-[rgb(var(--text-3))]" />
          <input autoFocus value={query} onChange={e => setQuery(e.target.value)} placeholder="Search notes…"
            className="flex-1 bg-transparent text-[13px] text-[rgb(var(--text))] outline-none placeholder:text-[rgb(var(--text-3))]" />
        </div>
        <div className="max-h-[320px] overflow-y-auto py-1">
          {filtered.length === 0
            ? <p className="px-4 py-6 text-center text-[12px] text-[rgb(var(--text-3))]">No notes found</p>
            : filtered.slice(0, 40).map(note => (
                <button key={note.id} type="button" onClick={() => onPick(note.id, note.title || 'Untitled')}
                  className="flex w-full items-center gap-2 px-4 py-2 text-left text-[13px] text-[rgb(var(--text))] transition hover:bg-[rgb(var(--surface-2))]">
                  <Icon name="file-text" size={13} className="shrink-0 text-[rgb(var(--accent))]" />
                  <span className="truncate">{note.title || 'Untitled'}</span>
                </button>
              ))
          }
        </div>
      </div>
    </div>
  )
}

// ─── Canvas title editor ──────────────────────────────────────────────────────

function CanvasTitleEditor({ canvas }: { canvas: Canvas }) {
  const updateCanvasTitle = useCanvasStore(s => s.updateCanvasTitle)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft]     = useState(canvas.title)
  useEffect(() => { setDraft(canvas.title) }, [canvas.title])

  function commit() {
    const title = draft.trim() || 'Untitled canvas'
    if (title !== canvas.title) updateCanvasTitle(canvas.id, title)
    setEditing(false)
  }

  if (editing) {
    return (
      <input autoFocus value={draft} onChange={e => setDraft(e.target.value)} onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') { setDraft(canvas.title); setEditing(false) } }}
        className="rounded border border-[rgb(var(--accent))] bg-[rgb(var(--surface))] px-2 py-0.5 text-[14px] font-semibold text-[rgb(var(--text))] outline-none"
        style={{ minWidth: 120, maxWidth: 280 }} />
    )
  }
  return (
    <button type="button" onClick={() => setEditing(true)} title="Click to rename"
      className="max-w-[260px] truncate rounded px-2 py-0.5 text-[14px] font-semibold text-[rgb(var(--text))] transition hover:bg-[rgb(var(--surface-2))]">
      {canvas.title}
    </button>
  )
}

// ─── Toolbar — safe inside ReactFlowProvider ──────────────────────────────────

function CanvasToolbar({ canvas, onAddText, onAddNote, onAddWeb, showMinimap, onToggleMinimap }: {
  canvas: Canvas; onAddText: () => void; onAddNote: () => void; onAddWeb: () => void
  showMinimap: boolean; onToggleMinimap: () => void
}) {
  const { fitView } = useReactFlow()

  return (
    <div className="flex items-center gap-1 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-2 py-1.5 shadow-lg">
      <CanvasTitleEditor canvas={canvas} />
      <div className="mx-1.5 h-4 w-px bg-[rgb(var(--border))]" />
      <ToolBtn label="Text card"  icon="sticky-note" onClick={onAddText} />
      <ToolBtn label="Note"       icon="file-text"   onClick={onAddNote} />
      <ToolBtn label="Web page"   icon="globe"        onClick={onAddWeb} />
      <div className="mx-1.5 h-4 w-px bg-[rgb(var(--border))]" />
      <ToolBtn label="Fit view"   icon="crosshair"   onClick={() => fitView({ padding: 0.12, duration: 300 })} />
      <ToolBtn label={showMinimap ? 'Hide minimap' : 'Minimap'} icon="layers" onClick={onToggleMinimap} active={showMinimap} />
    </div>
  )
}

function ToolBtn({ label, icon, onClick, active }: {
  label: string; icon: Parameters<typeof Icon>[0]['name']; onClick: () => void; active?: boolean
}) {
  return (
    <button type="button" title={label} onClick={onClick}
      className={`flex h-7 items-center gap-1.5 rounded-lg px-2 text-[12px] font-medium transition ${
        active ? 'bg-[rgb(var(--accent))]/15 text-[rgb(var(--accent))]'
               : 'text-[rgb(var(--text-2))] hover:bg-[rgb(var(--surface-2))] hover:text-[rgb(var(--text))]'
      }`}>
      <Icon name={icon} size={13} />
      <span>{label}</span>
    </button>
  )
}

// ─── Inner canvas (needs to be child of ReactFlowProvider) ────────────────────

function CanvasInner({ canvas }: { canvas: Canvas }) {
  const navigate            = useNavigate()
  const updateNodesAndEdges = useCanvasStore(s => s.updateNodesAndEdges)
  const colorMode           = useColorMode()

  const [showMinimap,    setShowMinimap]    = useState(false)
  const [showNotePicker, setShowNotePicker] = useState(false)

  // Stable refs for callbacks so nodes always get the latest version
  const navigateRef            = useRef(navigate)
  const updateNodesAndEdgesRef = useRef(updateNodesAndEdges)
  useEffect(() => { navigateRef.current            = navigate            }, [navigate])
  useEffect(() => { updateNodesAndEdgesRef.current = updateNodesAndEdges }, [updateNodesAndEdges])

  // Local nodes/edges — the source of truth for React Flow
  const [nodes, setNodes] = useState<Node[]>(() => toFlowNodes(canvas.nodes))
  const [edges, setEdges] = useState<Edge[]>(() => canvas.edges as Edge[])

  // Stable refs so debounced save always reads latest
  const nodesRef    = useRef(nodes)
  const edgesRef    = useRef(edges)
  const canvasIdRef = useRef(canvas.id)
  nodesRef.current  = nodes
  edgesRef.current  = edges

  // Reinit when switching canvases
  useEffect(() => {
    if (canvasIdRef.current !== canvas.id) {
      canvasIdRef.current = canvas.id
      setNodes(toFlowNodes(canvas.nodes))
      setEdges(canvas.edges as Edge[])
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvas.id])

  // Debounced save — single atomic update so useGraphData only reruns once
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scheduleSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null
      updateNodesAndEdgesRef.current(
        canvasIdRef.current,
        nodesRef.current.map(toCanvasNode),
        edgesRef.current as unknown as CanvasEdge[],
      )
    }, 600)
  }, [])

  // On unmount: cancel pending timer and flush immediately so edits are never
  // lost and no delayed store update fires while another page is initialising.
  useEffect(() => {
    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current)
        saveTimer.current = null
        updateNodesAndEdgesRef.current(
          canvasIdRef.current,
          nodesRef.current.map(toCanvasNode),
          edgesRef.current as unknown as CanvasEdge[],
        )
      }
    }
  }, [])

  // Stable callbacks injected into node.data
  const handleDelete = useCallback((nodeId: string) => {
    setNodes(ns => ns.filter(n => n.id !== nodeId))
    setEdges(es => es.filter(e => e.source !== nodeId && e.target !== nodeId))
    // save after state settles
    setTimeout(() => scheduleSave(), 0)
  }, [scheduleSave])

  const handleOpenNote = useCallback((noteId: string) => {
    navigateRef.current(`/notes/${noteId}`)
  }, [])

  // onDataChange: called by nodes to update their own data in local state
  const handleDataChange = useCallback((nodeId: string, patch: Record<string, unknown>) => {
    setNodes(ns => ns.map(n => n.id === nodeId ? { ...n, data: { ...n.data, ...patch } } : n))
    scheduleSave()
  }, [scheduleSave])

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes(ns => applyNodeChanges(changes, ns))
    scheduleSave()
  }, [scheduleSave])

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges(es => applyEdgeChanges(changes, es))
    scheduleSave()
  }, [scheduleSave])

  const onConnect = useCallback((params: Connection) => {
    setEdges(es => addEdge({ ...params, animated: false }, es))
    scheduleSave()
  }, [scheduleSave])

  // Inject stable callbacks into node data on every render (useMemo for perf)
  const nodesWithCallbacks = useMemo(() => nodes.map(n => ({
    ...n,
    dragHandle: '.drag-handle',
    data: {
      ...n.data,
      canvasId:       canvas.id,
      onDelete:       handleDelete,
      onOpenNote:     handleOpenNote,
      onDataChange:   handleDataChange,
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  })), [nodes, canvas.id, handleDelete, handleOpenNote, handleDataChange])

  function addNode(type: 'text' | 'note' | 'web', data: Record<string, unknown>, pos?: { x: number; y: number }) {
    const id      = crypto.randomUUID()
    const position = pos ?? { x: 160 + Math.random() * 120, y: 100 + Math.random() * 80 }
    const sizes: Record<string, { w: number; h: number }> = { text: { w: 260, h: 140 }, note: { w: 260, h: 180 }, web: { w: 420, h: 300 } }
    const { w, h } = sizes[type]
    const node: Node = { id, type, position, data, width: w, height: h, dragHandle: '.drag-handle' }
    setNodes(ns => [...ns, node])
    scheduleSave()
  }

  function handleAddNote(noteId: string, noteTitle: string) {
    setShowNotePicker(false)
    addNode('note', { noteId, noteTitle })
  }

  // Double-click pane → new text card at cursor
  const onPaneDoubleClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    if (!target.classList.contains('react-flow__pane')) return
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    addNode('text', { text: '' }, { x: e.clientX - rect.left - 130, y: e.clientY - rect.top - 70 })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvas.id])

  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      {/* Toolbar — outside <ReactFlow> but inside ReactFlowProvider, so useReactFlow() works */}
      <div className="absolute left-1/2 top-3 z-10 -translate-x-1/2">
        <CanvasToolbar
          canvas={canvas}
          onAddText={() => addNode('text', { text: '' })}
          onAddNote={() => setShowNotePicker(true)}
          onAddWeb={() => addNode('web', { url: '' })}
          showMinimap={showMinimap}
          onToggleMinimap={() => setShowMinimap(v => !v)}
        />
      </div>

      <ReactFlow
        nodes={nodesWithCallbacks}
        edges={edges}
        nodeTypes={NODE_TYPES as unknown as typeof NODE_TYPES}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDoubleClick={onPaneDoubleClick}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        deleteKeyCode="Delete"
        multiSelectionKeyCode="Shift"
        panOnScroll
        panOnDrag={[1, 2]}
        selectionOnDrag={false}
        nodesDraggable
        nodesConnectable
        elementsSelectable
        connectionMode={ConnectionMode.Loose}
        isValidConnection={() => true}
        proOptions={{ hideAttribution: true }}
        colorMode={colorMode}
      >
        <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="rgba(128,128,128,0.3)" />
        <Controls showZoom showFitView showInteractive={false}
          className="!border-[rgb(var(--border))] !bg-[rgb(var(--surface))] !shadow-lg [&_button]:!border-[rgb(var(--border))] [&_button]:!text-[rgb(var(--text-2))] [&_button:hover]:!bg-[rgb(var(--surface-2))]" />
        {showMinimap && (
          <MiniMap className="!border-[rgb(var(--border))] !bg-[rgb(var(--surface))]"
            nodeColor="rgb(var(--accent))" maskColor="rgba(0,0,0,0.5)" />
        )}
      </ReactFlow>

      {showNotePicker && <NotePickerModal onPick={handleAddNote} onClose={() => setShowNotePicker(false)} />}
    </div>
  )
}

// ─── Public export — wraps in provider so all hooks work ─────────────────────

export function CanvasView({ canvas }: { canvas: Canvas }) {
  return (
    <ReactFlowProvider>
      <CanvasInner canvas={canvas} />
    </ReactFlowProvider>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toFlowNodes(nodes: CanvasNode[]): Node[] {
  return nodes.map(n => ({
    id:           n.id,
    type:         n.type,
    position:     n.position,
    data:         { ...n.data } as Record<string, unknown>,
    width:        n.width,
    height:       n.height,
    dragHandle:   '.drag-handle',
  }))
}

function toCanvasNode(n: Node): CanvasNode {
  // Strip runtime-only callbacks before persisting
  const { canvasId: _a, onDelete: _b, onOpenNote: _c, onDataChange: _d, ...safeData } = n.data as Record<string, unknown>
  return {
    id:       n.id,
    type:     n.type as CanvasNode['type'],
    position: n.position,
    data:     safeData as CanvasNode['data'],
    width:    n.measured?.width ?? n.width,
    height:   n.measured?.height ?? n.height,
  }
}
