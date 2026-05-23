import { useNavigate } from 'react-router-dom'
import { useCanvasStore } from '../../../store/useCanvasStore'
import { timeAgo } from '../../../utils/timeAgo'
import { Icon } from '../../../icons/Icon'

export function CanvasList() {
  const navigate     = useNavigate()
  const canvases     = useCanvasStore(s => s.canvases)
  const createCanvas = useCanvasStore(s => s.createCanvas)
  const deleteCanvas = useCanvasStore(s => s.deleteCanvas)

  function handleNew() {
    const id = createCanvas()
    navigate(`/canvas/${id}`)
  }

  return (
    <div className="flex-1 overflow-y-auto bg-[rgb(var(--bg))] px-6 py-8">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon name="pen-tool" size={18} className="text-[rgb(var(--accent))]" />
            <h1 className="text-xl font-bold text-[rgb(var(--text))]">Canvas</h1>
            <span className="rounded-full bg-[rgb(var(--surface-2))] px-2 py-0.5 text-xs text-[rgb(var(--text-3))]">
              {canvases.length}
            </span>
          </div>
          <button
            type="button"
            onClick={handleNew}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[rgb(var(--accent))] px-3 py-1.5 text-[13px] font-medium text-white transition hover:opacity-90"
          >
            <Icon name="plus" size={14} />
            New canvas
          </button>
        </div>

        {/* Empty state */}
        {canvases.length === 0 ? (
          <button
            type="button"
            onClick={handleNew}
            className="flex w-full flex-col items-center gap-3 rounded-xl border-2 border-dashed border-[rgb(var(--border))] p-16 text-center text-[rgb(var(--text-3))] transition hover:border-[rgb(var(--accent))] hover:text-[rgb(var(--accent))]"
          >
            <Icon name="pen-tool" size={32} />
            <div>
              <p className="font-medium">No canvases yet</p>
              <p className="mt-1 text-sm">Create an infinite board for notes, links, and web pages</p>
            </div>
          </button>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {canvases.map(canvas => (
              <div
                key={canvas.id}
                className="group relative flex flex-col gap-3 rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-4 transition hover:border-[rgb(var(--accent))] hover:shadow-md"
              >
                <button
                  type="button"
                  onClick={() => navigate(`/canvas/${canvas.id}`)}
                  className="flex flex-col gap-1.5 text-left"
                >
                  {/* Canvas preview dots */}
                  <div className="mb-2 flex h-20 items-center justify-center rounded-lg bg-[rgb(var(--surface-2))] overflow-hidden">
                    <div className="flex gap-2 opacity-40">
                      {Array.from({ length: Math.min(canvas.nodes.length, 5) }).map((_, i) => (
                        <div key={i} className="h-8 w-12 rounded bg-[rgb(var(--accent))]" style={{ opacity: 0.3 + i * 0.14 }} />
                      ))}
                      {canvas.nodes.length === 0 && (
                        <Icon name="pen-tool" size={28} className="text-[rgb(var(--text-3))]" />
                      )}
                    </div>
                  </div>
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="line-clamp-1 text-sm font-semibold text-[rgb(var(--text))]">
                      {canvas.title}
                    </h2>
                    <span className="flex-shrink-0 text-[10px] text-[rgb(var(--text-3))]">
                      {timeAgo(canvas.updatedAt)}
                    </span>
                  </div>
                  <p className="text-[11px] text-[rgb(var(--text-3))]">
                    {canvas.nodes.length} {canvas.nodes.length === 1 ? 'card' : 'cards'} · {canvas.edges.length} {canvas.edges.length === 1 ? 'connection' : 'connections'}
                  </p>
                </button>

                {/* Delete on hover */}
                <button
                  type="button"
                  onClick={() => deleteCanvas(canvas.id)}
                  title="Delete canvas"
                  className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded text-[rgb(var(--text-3))] opacity-0 transition hover:text-red-400 group-hover:opacity-100"
                >
                  <Icon name="trash-2" size={13} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
