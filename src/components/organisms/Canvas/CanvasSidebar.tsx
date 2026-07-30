import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useCanvasStore } from '../../../store/useCanvasStore'
import { useSelectionStore, useIsSelecting, exitSelection } from '../../../store/useSelectionStore'
import { useSortPref } from '../../../store/useSortStore'
import { sortItems } from '../../../utils/sortItems'
import { useBulkDelete } from '../../../hooks/useBulkDelete'
import { Icon } from '../../../icons/Icon'
import { IconButton } from '../../atoms/IconButton'
import { SectionLabel } from '../../atoms/SectionLabel'
import { Divider } from '../../atoms/Divider'
import { SelectionToolbar } from '../../molecules/SelectionToolbar'
import { SortMenu } from '../../molecules/SortMenu'
import { CanvasSidebarRow } from './CanvasSidebarRow'

export function CanvasSidebar() {
  const navigate      = useNavigate()
  const { canvasId }  = useParams<{ canvasId?: string }>()
  const allCanvases   = useCanvasStore(s => s.canvases)
  const createCanvas  = useCanvasStore(s => s.createCanvas)
  const deleteCanvas  = useCanvasStore(s => s.deleteCanvas)
  const updateCanvasTitle = useCanvasStore(s => s.updateCanvasTitle)

  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameVal, setRenameVal]   = useState('')

  const sortPref = useSortPref('canvas')
  const canvases = useMemo(() => sortItems(allCanvases, sortPref, c => c.title), [allCanvases, sortPref])

  // ── Multi-select ──
  const isSelecting = useIsSelecting('canvas')
  const enterSelect = useSelectionStore(s => s.enter)
  const setOrder    = useSelectionStore(s => s.setOrder)

  const selectableIds = useMemo(() => canvases.map(c => c.id), [canvases])

  useEffect(() => { if (isSelecting) setOrder(selectableIds) }, [isSelecting, selectableIds, setOrder])
  useEffect(() => () => exitSelection('canvas'), [])

  // Leave the canvas route if the one on screen is among the deleted.
  const removeCanvas = useCallback((id: string) => {
    deleteCanvas(id)
    if (canvasId === id) navigate('/canvas')
  }, [deleteCanvas, canvasId, navigate])

  const deleteSelected = useBulkDelete({
    scope: 'canvas', noun: 'canvas', plural: 'canvases', remove: removeCanvas,
  })

  function commitRename() {
    if (!renamingId) return
    const title = renameVal.trim() || 'Untitled canvas'
    updateCanvasTitle(renamingId, title)
    setRenamingId(null)
  }

  function handleNew() {
    const id = createCanvas()
    navigate(`/canvas/${id}`)
  }

  function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation()
    deleteCanvas(id)
    if (canvasId === id) navigate('/canvas')
  }

  return (
    <div className="flex h-full flex-col overflow-hidden bg-[rgb(var(--surface-2))]">
      {/* Header */}
      <div className="flex h-10 shrink-0 items-center justify-between px-3">
        <SectionLabel>Canvas</SectionLabel>
        <div className="flex items-center gap-1">
          {canvases.length > 0 && <SortMenu scope="canvas" />}
          {canvases.length > 0 && (
            <IconButton
              icon="check-square"
              label={isSelecting ? 'Exit selection' : 'Select canvases'}
              size="xs"
              onClick={() => (isSelecting ? exitSelection('canvas') : enterSelect('canvas', selectableIds))}
              className={isSelecting ? 'bg-accent/15 text-accent' : ''}
            />
          )}
          <IconButton icon="plus" label="New canvas" size="xs" onClick={handleNew} />
        </div>
      </div>

      <Divider />

      {isSelecting && (
        <SelectionToolbar
          scope="canvas"
          noun="canvas"
          plural="canvases"
          onDelete={deleteSelected}
          onExit={() => exitSelection('canvas')}
        />
      )}

      {/* Canvas list */}
      <div className="flex-1 overflow-y-auto py-1">
        {canvases.length === 0 ? (
          <button
            type="button"
            onClick={handleNew}
            className="mx-2 mt-2 flex w-[calc(100%-16px)] flex-col items-center gap-2 rounded-lg border border-dashed border-[rgb(var(--border))] py-6 text-center text-[rgb(var(--text-3))] transition hover:border-[rgb(var(--accent))] hover:text-[rgb(var(--accent))]"
          >
            <Icon name="plus" size={18} />
            <span className="text-[12px]">New canvas</span>
          </button>
        ) : (
          canvases.map(canvas => (
            <CanvasSidebarRow
              key={canvas.id}
              canvas={canvas}
              isActive={canvas.id === canvasId}
              isRenaming={renamingId === canvas.id}
              renameVal={renameVal}
              onRenameChange={setRenameVal}
              onRenameCommit={commitRename}
              onRenameCancel={() => setRenamingId(null)}
              onOpen={() => navigate(`/canvas/${canvas.id}`)}
              onStartRename={() => { setRenamingId(canvas.id); setRenameVal(canvas.title) }}
              onDelete={e => handleDelete(canvas.id, e)}
            />
          ))
        )}
      </div>
    </div>
  )
}
