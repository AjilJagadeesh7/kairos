import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useCanvasStore } from '../../../store/useCanvasStore'
import { timeAgo } from '../../../utils/timeAgo'
import { Icon } from '../../../icons/Icon'
import { IconButton } from '../../atoms/IconButton'
import { SectionLabel } from '../../atoms/SectionLabel'
import { Divider } from '../../atoms/Divider'
import { InlineEditInput } from '../../molecules/InlineEditInput'

export function CanvasSidebar() {
  const navigate      = useNavigate()
  const { canvasId }  = useParams<{ canvasId?: string }>()
  const canvases      = useCanvasStore(s => s.canvases)
  const createCanvas  = useCanvasStore(s => s.createCanvas)
  const deleteCanvas  = useCanvasStore(s => s.deleteCanvas)
  const updateCanvasTitle = useCanvasStore(s => s.updateCanvasTitle)

  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameVal, setRenameVal]   = useState('')

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
        <IconButton icon="plus" label="New canvas" size="xs" onClick={handleNew} />
      </div>

      <Divider />

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
          canvases.map(canvas => {
            const isActive = canvas.id === canvasId
            return (
              <div
                key={canvas.id}
                className={`group relative flex cursor-pointer items-center gap-2 px-3 py-2 transition ${
                  isActive ? 'bg-[rgb(var(--accent))]/10 text-[rgb(var(--text))]' : 'text-[rgb(var(--text-2))] hover:bg-[rgb(var(--surface-3))] hover:text-[rgb(var(--text))]'
                }`}
                onClick={() => navigate(`/canvas/${canvas.id}`)}
              >
                {isActive && <span className="absolute inset-y-1 left-0 w-0.5 rounded-r-full bg-[rgb(var(--accent))]" />}

                <Icon name="layout-dashboard" size={13} className={`shrink-0 ${isActive ? 'text-[rgb(var(--accent))]' : 'text-[rgb(var(--text-3))]'}`} />

                <div className="min-w-0 flex-1">
                  {renamingId === canvas.id ? (
                    <InlineEditInput
                      value={renameVal}
                      onChange={setRenameVal}
                      onCommit={commitRename}
                      onCancel={() => setRenamingId(null)}
                      className="w-full px-1"
                    />
                  ) : (
                    <p className="truncate text-[12px] font-medium leading-tight">{canvas.title}</p>
                  )}
                  <p className="text-[10px] text-[rgb(var(--text-3))]">{timeAgo(canvas.updatedAt)}</p>
                </div>

                {/* Hover actions */}
                <div className="absolute right-2 top-0 flex h-full items-center gap-0.5 opacity-0 transition group-hover:opacity-100">
                  <button
                    type="button"
                    title="Rename"
                    onClick={e => { e.stopPropagation(); setRenamingId(canvas.id); setRenameVal(canvas.title) }}
                    className="flex h-5 w-5 items-center justify-center rounded text-[rgb(var(--text-3))] transition hover:text-[rgb(var(--text))]"
                  >
                    <Icon name="pencil" size={11} />
                  </button>
                  <button
                    type="button"
                    title="Delete"
                    onClick={e => handleDelete(canvas.id, e)}
                    className="flex h-5 w-5 items-center justify-center rounded text-[rgb(var(--text-3))] transition hover:text-red-400"
                  >
                    <Icon name="trash-2" size={11} />
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
