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
} from '@xyflow/react'
import { useCanvasStore } from '../../../store/useCanvasStore'
import { useColorMode } from '../../../hooks/useColorMode'
import { CanvasToolbar } from './CanvasToolbar'
import { NotePickerModal } from './NotePickerModal'
import { TextNode } from './nodes/TextNode'
import { NoteNode } from './nodes/NoteNode'
import { WebNode } from './nodes/WebNode'
import { useCanvasNodeTypes } from '../../../plugins/pluginContext'
import type { Canvas, CanvasNode, CanvasEdge } from '../../../types'

const BUILTIN_NODE_TYPES = { text: TextNode, note: NoteNode, web: WebNode }

function CanvasInner({ canvas }: { canvas: Canvas }) {
  const navigate            = useNavigate()
  const updateNodesAndEdges = useCanvasStore(s => s.updateNodesAndEdges)
  const colorMode           = useColorMode()
  const pluginNodeTypes     = useCanvasNodeTypes()
  const nodeTypes           = useMemo(() => ({ ...BUILTIN_NODE_TYPES, ...pluginNodeTypes }), [pluginNodeTypes])

  const [showMinimap,    setShowMinimap]    = useState(false)
  const [showNotePicker, setShowNotePicker] = useState(false)

  const navigateRef            = useRef(navigate)
  const updateNodesAndEdgesRef = useRef(updateNodesAndEdges)
  useEffect(() => { navigateRef.current            = navigate            }, [navigate])
  useEffect(() => { updateNodesAndEdgesRef.current = updateNodesAndEdges }, [updateNodesAndEdges])

  const [nodes, setNodes] = useState<Node[]>(() => toFlowNodes(canvas.nodes))
  const [edges, setEdges] = useState<Edge[]>(() => canvas.edges as Edge[])

  const nodesRef    = useRef(nodes)
  const edgesRef    = useRef(edges)
  const canvasIdRef = useRef(canvas.id)
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

  const handleDelete = useCallback((nodeId: string) => {
    setNodes(ns => ns.filter(n => n.id !== nodeId))
    setEdges(es => es.filter(e => e.source !== nodeId && e.target !== nodeId))
    setTimeout(() => scheduleSave(), 0)
  }, [scheduleSave])

  const handleOpenNote = useCallback((noteId: string) => {
    navigateRef.current(`/notes/${noteId}`)
  }, [])

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

  const nodesWithCallbacks = useMemo(() => nodes.map(n => ({
    ...n,
    dragHandle: '.drag-handle',
    data: {
      ...n.data,
      canvasId:     canvas.id,
      onDelete:     handleDelete,
      onOpenNote:   handleOpenNote,
      onDataChange: handleDataChange,
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

  const onPaneDoubleClick = useCallback((e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    if (!target.classList.contains('react-flow__pane')) return
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
    addNode('text', { text: '' }, { x: e.clientX - rect.left - 130, y: e.clientY - rect.top - 70 })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvas.id])

  return (
    <div className="relative flex h-full flex-col overflow-hidden">
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
        nodeTypes={nodeTypes as Parameters<typeof ReactFlow>[0]['nodeTypes']}
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

export function CanvasView({ canvas }: { canvas: Canvas }) {
  return (
    <ReactFlowProvider>
      <CanvasInner canvas={canvas} />
    </ReactFlowProvider>
  )
}

function toFlowNodes(nodes: CanvasNode[]): Node[] {
  return nodes.map(n => ({
    id:         n.id,
    type:       n.type,
    position:   n.position,
    data:       { ...n.data } as Record<string, unknown>,
    width:      n.width,
    height:     n.height,
    dragHandle: '.drag-handle',
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
