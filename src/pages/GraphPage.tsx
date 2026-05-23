import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/schema'
import { useAppStore } from '../store/useAppStore'
import { useKanbanStore } from '../store/useKanbanStore'
import { usePaneStore } from '../store/usePaneStore'
import { usePaneId, useSidebarSlot } from '../contexts/PaneContext'
import { SidebarWrapper } from '../components/organisms/Sidebar/SidebarWrapper'
import { useGraphData } from '../hooks/useGraphData'
import { GraphSidebar } from '../components/organisms/Graph/GraphSidebar'
import { GraphView } from '../components/organisms/Graph/GraphView'
import { GraphContextMenu } from '../components/organisms/Graph/GraphContextMenu'
import { ErrorBoundary } from '../components/common/ErrorBoundary'
import type { RightClickTarget } from '../components/organisms/Graph/GraphView'

// Isolated so that focusedPaneId changes never re-render GraphPage/GraphView
function GraphSidebarPortal({ paneId, sidebar }: { paneId: string; sidebar: React.ReactNode }) {
  const focusedPaneId = usePaneStore(s => s.focusedPaneId)
  const slot          = useSidebarSlot()
  if (focusedPaneId !== paneId || !slot) return null
  return createPortal(sidebar, slot)
}

type GraphMode = 'links' | 'tags'

export function GraphPage() {
  const navigate             = useNavigate()
  const notes                = useAppStore(s => s.notes)
  const appendWikilink       = useAppStore(s => s.appendWikilink)
  const paneId               = usePaneId()
  const isMultiPane          = usePaneStore(s => s.panes.length > 1)

  const [graphMode,      setGraphMode]      = useState<GraphMode>('links')
  const [rerenderKey,    setRerenderKey]    = useState(0)
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [showTasks,      setShowTasks]      = useState(true)
  const [showCanvas,     setShowCanvas]     = useState(true)
  const [focusMode,      setFocusMode]      = useState(false)
  const [contextMenu,    setContextMenu]    = useState<RightClickTarget | null>(null)

  const embeddings = useLiveQuery(() => db.embeddings.toArray()) || []
  const embeddingMap = useMemo(() => {
    return new Map<string, number[]>(embeddings.map(e => [e.noteId, e.data]))
  }, [embeddings])

  const { tagColorMap, linksNodes, linksLinks, tagsNodes, tagsLinks, taskNodes, taskLinks, canvasNodes, canvasLinks, tagLegendItems, selectedNote } =
    useGraphData(notes, embeddingMap, rerenderKey, selectedNodeId, showTasks)

  const baseNodes = graphMode === 'links' ? linksNodes : tagsNodes
  const baseLinks = graphMode === 'links' ? linksLinks : tagsLinks
  const nodes = useMemo(() => {
    let result = [...baseNodes]
    if (showTasks)  result = [...result, ...taskNodes]
    if (showCanvas) result = [...result, ...canvasNodes]
    return result
  }, [showTasks, showCanvas, baseNodes, taskNodes, canvasNodes])
  const links = useMemo(() => {
    // Shallow-clone every link object so react-force-graph-2d's in-place mutation
    // (replacing source/target string IDs with node object refs) never bleeds into
    // the next render cycle, preventing stale references on graph remount.
    let result = baseLinks.map(l => ({ ...l }))
    if (showTasks)  result = [...result, ...taskLinks.map(l => ({ ...l }))]
    if (showCanvas) result = [...result, ...canvasLinks.map(l => ({ ...l }))]
    return result
  }, [showTasks, showCanvas, baseLinks, taskLinks, canvasLinks])

  const wikilinkCount  = linksLinks.filter(l => l.kind === 'wikilink').length
  const semanticCount  = linksLinks.filter(l => l.kind === 'semantic').length
  const taskNodeCount  = taskNodes.length
  const canvasNodeCount = canvasNodes.length

  // Neighborhood: all node IDs directly connected to the selected node
  const neighborIds = useMemo(() => {
    if (!selectedNodeId) return new Set<string>()
    const ids = new Set<string>()
    for (const link of links) {
      const src = typeof link.source === 'object' ? link.source.id : link.source
      const tgt = typeof link.target === 'object' ? link.target.id : link.target
      if (src === selectedNodeId) ids.add(tgt)
      if (tgt === selectedNodeId) ids.add(src)
    }
    ids.add(selectedNodeId)
    return ids
  }, [selectedNodeId, links])

  // Selected task info for sidebar panel
  const selectedTaskInfo = useMemo(() => {
    if (!selectedNodeId) return null
    const node = nodes.find(n => n.id === selectedNodeId)
    if (!node || node.nodeType !== 'task') return null
    const boards = useKanbanStore.getState().boards
    for (const board of boards) {
      const task = board.tasks.find(t => t.id === selectedNodeId)
      if (task) {
        const col = board.columns.find(c => c.id === task.columnId)
        return {
          nodeId:     selectedNodeId,
          label:      task.title,
          boardName:  board.title,
          columnName: col?.title ?? 'Unknown',
          boardId:    board.id,
        }
      }
    }
    return null
  }, [selectedNodeId, nodes])

  function handleModeChange(mode: GraphMode) {
    setSelectedNodeId(null)
    setFocusMode(false)
    setGraphMode(mode)
    setRerenderKey(k => k + 1)
  }

  function handleSelectNode(nodeId: string | null) {
    setSelectedNodeId(nodeId)
    if (!nodeId) setFocusMode(false)
  }

  function handleToggleFocus() {
    if (!selectedNodeId) return
    setFocusMode(v => !v)
  }

  function handleOpenTask(nodeId: string) {
    const task = selectedTaskInfo
    if (!task) return
    navigate(`/kanban/${task.boardId}`)
    useKanbanStore.getState().setActiveTaskId(nodeId)
  }

  async function handleLinkCreate(sourceId: string, targetNoteId: string) {
    const sourceNode = nodes.find(n => n.id === sourceId)
    const targetNote = notes.find(n => n.id === targetNoteId)
    if (!targetNote) return

    if (!sourceNode || sourceNode.nodeType === 'note') {
      // Insert [[targetTitle]] into source note content
      await appendWikilink(sourceId, targetNote.title || 'Untitled note')
      setRerenderKey(k => k + 1)
    } else if (sourceNode.nodeType === 'task') {
      // Add note to task.linkedNotes
      const boards = useKanbanStore.getState().boards
      for (const board of boards) {
        const task = board.tasks.find(t => t.id === sourceId)
        if (task) {
          const existing = task.linkedNotes ?? []
          if (!existing.includes(targetNoteId)) {
            useKanbanStore.getState().updateTask(board.id, sourceId, { linkedNotes: [...existing, targetNoteId] })
          }
          break
        }
      }
      setRerenderKey(k => k + 1)
    }
  }

  const graphSidebar = (
    <GraphSidebar
      graphMode={graphMode}
      onModeChange={handleModeChange}
      nodes={nodes}
      links={links}
      wikilinkCount={wikilinkCount}
      semanticCount={semanticCount}
      taskNodeCount={taskNodeCount}
      canvasNodeCount={canvasNodeCount}
      tagLegendItems={tagLegendItems}
      tagColorMap={tagColorMap}
      selectedNote={selectedNote}
      selectedTaskInfo={selectedTaskInfo}
      showTasks={showTasks}
      showCanvas={showCanvas}
      onToggleTasks={() => setShowTasks(v => !v)}
      onToggleCanvas={() => setShowCanvas(v => !v)}
      onOpenNote={id => navigate(`/notes/${id}`)}
      onOpenTask={handleOpenTask}
    />
  )

  return (
    <ErrorBoundary>
    <main className="relative flex h-full overflow-hidden">
      {isMultiPane
        ? <GraphSidebarPortal paneId={paneId} sidebar={graphSidebar} />
        : <SidebarWrapper>{graphSidebar}</SidebarWrapper>
      }

      <section className="flex min-w-0 flex-1 flex-col">
        <GraphView
          nodes={nodes}
          links={links}
          graphMode={graphMode}
          tagColorMap={tagColorMap}
          selectedNoteId={selectedNodeId}
          focusedNodeId={selectedNodeId}
          neighborIds={neighborIds}
          focusMode={focusMode}
          onSelectNode={handleSelectNode}
          onOpenNote={id => navigate(`/notes/${id}`)}
          onOpenCanvas={id => navigate(`/canvas/${id}`)}
          onRightClickNode={setContextMenu}
          onToggleFocus={handleToggleFocus}
          rerenderKey={rerenderKey}
          onRelayout={() => { setSelectedNodeId(null); setFocusMode(false); setRerenderKey(k => k + 1) }}
        />
      </section>

      {contextMenu && (
        <GraphContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          nodeId={contextMenu.node.id}
          nodeLabel={contextMenu.node.label}
          nodeType={contextMenu.node.nodeType}
          onClose={() => setContextMenu(null)}
          onOpenNote={id => { navigate(`/notes/${id}`); setContextMenu(null) }}
          onOpenTask={id => { handleOpenTask(id); setContextMenu(null) }}
          onLinkToNote={(srcId, tgtId) => { void handleLinkCreate(srcId, tgtId); setContextMenu(null) }}
        />
      )}
    </main>
    </ErrorBoundary>
  )
}
