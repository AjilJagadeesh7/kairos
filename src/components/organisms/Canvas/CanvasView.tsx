import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ReactFlow, ReactFlowProvider, Background, Controls, MiniMap,
  addEdge, applyNodeChanges, applyEdgeChanges, BackgroundVariant, ConnectionMode,
  type Node, type Edge, type Connection, type NodeChange, type EdgeChange,
} from '@xyflow/react'
import { useCanvasStore } from '../../../store/useCanvasStore'
import { useColorMode } from '../../../hooks/useColorMode'
import { useCanvasHistory } from '../../../hooks/useCanvasHistory'
import { CanvasToolbar } from './CanvasToolbar'
import { CanvasNodeContextMenu } from './CanvasNodeContextMenu'
import { NotePickerModal } from './NotePickerModal'
import { TextNode } from './nodes/TextNode'
import { NoteNode } from './nodes/NoteNode'
import { WebNode } from './nodes/WebNode'
import { useCanvasNodeTypes } from '../../../plugins/pluginContext'
import { toFlowNodes, toCanvasNode, toCanvasEdge } from './canvasUtils'
import { useCanvasKeyboard } from './useCanvasKeyboard'
import type { Canvas, CanvasEdge } from '../../../types'

const BUILTIN_NODE_TYPES = { text: TextNode, note: NoteNode, web: WebNode }

interface NodeCtxMenu { x: number; y: number; nodeId: string; locked: boolean }
interface EditingEdge  { id: string; x: number; y: number; label: string }

function CanvasInner({ canvas }: { canvas: Canvas }) {
  const navigate            = useNavigate()
  const updateNodesAndEdges = useCanvasStore(s => s.updateNodesAndEdges)
  const colorMode           = useColorMode()
  const pluginNodeTypes     = useCanvasNodeTypes()
  const nodeTypes           = useMemo(() => ({ ...BUILTIN_NODE_TYPES, ...pluginNodeTypes }), [pluginNodeTypes])
  const history             = useCanvasHistory()

  const [nodes,          setNodes]          = useState<Node[]>(() => toFlowNodes(canvas.nodes))
  const [edges,          setEdges]          = useState<Edge[]>(() => canvas.edges as Edge[])
  const [showMinimap,    setShowMinimap]    = useState(false)
  const [showNotePicker, setShowNotePicker] = useState(false)
  const [selectMode,     setSelectMode]     = useState(false)
  const [nodeCtxMenu,    setNodeCtxMenu]    = useState<NodeCtxMenu | null>(null)
  const [editingEdge,    setEditingEdge]    = useState<EditingEdge | null>(null)

  const navigateRef            = useRef(navigate)
  const updateNodesAndEdgesRef = useRef(updateNodesAndEdges)
  const nodesRef               = useRef(nodes)
  const edgesRef               = useRef(edges)
  const canvasIdRef            = useRef(canvas.id)
  useEffect(() => { navigateRef.current            = navigate            }, [navigate])
  useEffect(() => { updateNodesAndEdgesRef.current = updateNodesAndEdges }, [updateNodesAndEdges])
  nodesRef.current  = nodes
  edgesRef.current  = edges

  useEffect(() => {
    if (canvasIdRef.current !== canvas.id) {
      canvasIdRef.current = canvas.id
      setNodes(toFlowNodes(canvas.nodes))
      setEdges(canvas.edges as Edge[])
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvas.id])

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const scheduleSave = useCallback(() => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      saveTimer.current = null
      updateNodesAndEdgesRef.current(
        canvasIdRef.current,
        nodesRef.current.map(toCanvasNode),
        edgesRef.current.map(toCanvasEdge) as unknown as CanvasEdge[],
      )
    }, 600)
  }, [])

  useEffect(() => () => {
    if (saveTimer.current) {
      clearTimeout(saveTimer.current)
      saveTimer.current = null
      updateNodesAndEdgesRef.current(
        canvasIdRef.current,
        nodesRef.current.map(toCanvasNode),
        edgesRef.current.map(toCanvasEdge) as unknown as CanvasEdge[],
      )
    }
  }, [])

  // ── Keyboard shortcuts: undo/redo, duplicate ────────────────────────────
  useCanvasKeyboard({
    nodesRef, edgesRef, setNodes, scheduleSave,
    undo: history.undo, redo: history.redo, pushHistory: history.push,
    onUndoApply: p => { setNodes(p.nodes); setEdges(p.edges) },
    onRedoApply: n => { setNodes(n.nodes); setEdges(n.edges) },
  })

  // ── Node / edge change handlers ─────────────────────────────────────────
  const onNodesChange = useCallback((changes: NodeChange[]) => {
    if (changes.some(c => c.type === 'remove'))
      history.push({ nodes: nodesRef.current, edges: edgesRef.current })
    setNodes(ns => applyNodeChanges(changes, ns))
    scheduleSave()
  }, [scheduleSave, history])

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    if (changes.some(c => c.type === 'remove'))
      history.push({ nodes: nodesRef.current, edges: edgesRef.current })
    setEdges(es => applyEdgeChanges(changes, es))
    scheduleSave()
  }, [scheduleSave, history])

  const onConnect = useCallback((params: Connection) => {
    history.push({ nodes: nodesRef.current, edges: edgesRef.current })
    setEdges(es => addEdge({ ...params, animated: false }, es))
    scheduleSave()
  }, [scheduleSave, history])

  const onNodeDragStart = useCallback(() => history.push({ nodes: nodesRef.current, edges: edgesRef.current }), [history])

  // ── Node callbacks ──────────────────────────────────────────────────────
  const handleDelete = useCallback((nodeId: string) => {
    history.push({ nodes: nodesRef.current, edges: edgesRef.current })
    setNodes(ns => ns.filter(n => n.id !== nodeId))
    setEdges(es => es.filter(e => e.source !== nodeId && e.target !== nodeId))
    setTimeout(() => scheduleSave(), 0)
  }, [scheduleSave, history])

  const handleOpenNote = useCallback((noteId: string) => { navigateRef.current(`/notes/${noteId}`) }, [])

  const handleDataChange = useCallback((nodeId: string, patch: Record<string, unknown>) => {
    setNodes(ns => ns.map(n => n.id === nodeId ? { ...n, data: { ...n.data, ...patch } } : n))
    scheduleSave()
  }, [scheduleSave])

  // ── Context menu ────────────────────────────────────────────────────────
  const onNodeContextMenu = useCallback((e: React.MouseEvent, node: Node) => {
    e.preventDefault()
    const locked = !!(node.data as Record<string, unknown>).locked
    setNodeCtxMenu({ x: e.clientX, y: e.clientY, nodeId: node.id, locked })
  }, [])

  function handleCtxLock()      { if (nodeCtxMenu) handleDataChange(nodeCtxMenu.nodeId, { locked: !nodeCtxMenu.locked }) }
  function handleCtxDelete()    { if (nodeCtxMenu) handleDelete(nodeCtxMenu.nodeId) }
  function handleCtxDuplicate() {
    if (!nodeCtxMenu) return
    const n = nodesRef.current.find(nd => nd.id === nodeCtxMenu.nodeId)
    if (!n) return
    history.push({ nodes: nodesRef.current, edges: edgesRef.current })
    setNodes(ns => [...ns, { ...n, id: crypto.randomUUID(), position: { x: n.position.x + 30, y: n.position.y + 30 }, selected: false }])
    scheduleSave()
  }

  // ── Edge labels ─────────────────────────────────────────────────────────
  const onEdgeDoubleClick = useCallback((e: React.MouseEvent, edge: Edge) => {
    const currentLabel = (edge.label as string | undefined) ?? ''
    setEditingEdge({ id: edge.id, x: e.clientX, y: e.clientY, label: currentLabel })
  }, [])

  function commitEdgeLabel() {
    if (!editingEdge) return
    setEdges(es => es.map(e => e.id === editingEdge.id ? { ...e, label: editingEdge.label || undefined } : e))
    setEditingEdge(null)
    scheduleSave()
  }

  // ── Add nodes ───────────────────────────────────────────────────────────
  function addNode(type: 'text' | 'note' | 'web', data: Record<string, unknown>, pos?: { x: number; y: number }) {
    const id       = crypto.randomUUID()
    const position = pos ?? { x: 160 + Math.random() * 120, y: 100 + Math.random() * 80 }
    const sizes: Record<string, { w: number; h: number }> = { text: { w: 260, h: 140 }, note: { w: 260, h: 180 }, web: { w: 420, h: 300 } }
    const { w, h } = sizes[type]
    history.push({ nodes: nodesRef.current, edges: edgesRef.current })
    setNodes(ns => [...ns, { id, type, position, data, width: w, height: h, dragHandle: '.drag-handle' }])
    scheduleSave()
  }

  function handleAddNote(noteId: string, noteTitle: string) {
    setShowNotePicker(false)
    addNode('note', { noteId, noteTitle })
  }

  const onPaneDoubleClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    if (!target.classList.contains('react-flow__pane')) return
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    addNode('text', { text: '' }, { x: e.clientX - rect.left - 130, y: e.clientY - rect.top - 70 })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvas.id])

  // ── Nodes with injected callbacks + locked/collapsed state ──────────────
  const nodesWithCallbacks = useMemo(() => nodes.map(n => {
    const d        = n.data as Record<string, unknown>
    const locked   = !!d.locked
    const collapsed = n.type === 'note' && !!d.collapsed
    return {
      ...n,
      dragHandle: '.drag-handle',
      draggable: !locked,
      // height:32 when collapsed → ReactFlow repositions handles to the actual header size
      ...(collapsed ? { height: 32 } : {}),
      data: {
        ...n.data,
        canvasId:     canvas.id,
        onDelete:     handleDelete,
        onOpenNote:   handleOpenNote,
        onDataChange: handleDataChange,
      },
    }
  }), [nodes, canvas.id, handleDelete, handleOpenNote, handleDataChange])

  return (
    <div className="relative flex h-full flex-col overflow-hidden">
      {/* Hugs the toolbar at every width. The old `inset-x-2` below `md` made this
          a full-width transparent strip at z-10, which swallowed every click that
          landed beside the toolbar — panning, node selection and the tab bar row
          all went dead in a narrow window while working fine when maximised. */}
      {/* z-[100]: React Flow elevates selected/dragged nodes to z-index 1000+ and
          its panels sit at 5, so the old z-10 let a node overlapping the toolbar
          render above it and swallow the clicks. */}
      <div className="absolute left-1/2 top-3 z-[100] flex w-max max-w-[calc(100%-1rem)] -translate-x-1/2 overflow-x-auto">
        <CanvasToolbar
          canvas={canvas}
          onAddText={() => addNode('text', { text: '' })}
          onAddNote={() => setShowNotePicker(true)}
          onAddWeb={() => addNode('web', { url: '' })}
          showMinimap={showMinimap}
          onToggleMinimap={() => setShowMinimap(v => !v)}
          selectMode={selectMode}
          onToggleSelectMode={() => setSelectMode(v => !v)}
          canUndo={history.canUndo}
          canRedo={history.canRedo}
          onUndo={() => { const p = history.undo({ nodes: nodesRef.current, edges: edgesRef.current }); if (p) { setNodes(p.nodes); setEdges(p.edges); scheduleSave() } }}
          onRedo={() => { const n = history.redo({ nodes: nodesRef.current, edges: edgesRef.current }); if (n) { setNodes(n.nodes); setEdges(n.edges); scheduleSave() } }}
        />
      </div>

      <ReactFlow
        nodes={nodesWithCallbacks}
        edges={edges}
        nodeTypes={nodeTypes as Parameters<typeof ReactFlow>[0]['nodeTypes']}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onDoubleClick={onPaneDoubleClick}
        onNodeContextMenu={onNodeContextMenu}
        onEdgeDoubleClick={onEdgeDoubleClick}
        onNodeDragStart={onNodeDragStart}
        onPaneClick={() => setNodeCtxMenu(null)}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        deleteKeyCode="Delete"
        multiSelectionKeyCode="Shift"
        panOnScroll
        panOnDrag={selectMode ? [2] : [1, 2]}
        selectionOnDrag={selectMode}
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
          <MiniMap zoomable pannable className="!border-[rgb(var(--border))] !bg-[rgb(var(--surface))]"
            nodeColor="rgb(var(--accent))" maskColor="rgba(0,0,0,0.5)" />
        )}
      </ReactFlow>

      {showNotePicker && <NotePickerModal onPick={handleAddNote} onClose={() => setShowNotePicker(false)} />}

      {nodeCtxMenu && (
        <CanvasNodeContextMenu
          x={nodeCtxMenu.x} y={nodeCtxMenu.y} locked={nodeCtxMenu.locked}
          onLockToggle={handleCtxLock}
          onDuplicate={handleCtxDuplicate}
          onDelete={handleCtxDelete}
          onClose={() => setNodeCtxMenu(null)}
        />
      )}

      {editingEdge && (
        <div className="fixed z-[300]" style={{ left: editingEdge.x, top: editingEdge.y - 40 }}>
          <input
            autoFocus
            value={editingEdge.label}
            onChange={e => setEditingEdge(ev => ev ? { ...ev, label: e.target.value } : ev)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') commitEdgeLabel() }}
            onBlur={commitEdgeLabel}
            placeholder="Edge label…"
            className="min-w-[140px] rounded-lg border border-[rgb(var(--accent))] bg-[rgb(var(--surface))] px-2.5 py-1.5 text-[12px] text-[rgb(var(--text))] shadow-lg outline-none placeholder:text-[rgb(var(--text-3))]"
          />
        </div>
      )}
    </div>
  )
}

export function CanvasView({ canvas }: { canvas: Canvas }) {
  return (
    <ReactFlowProvider>
      <CanvasInner canvas={canvas} />
    </ReactFlowProvider>
  )
}
