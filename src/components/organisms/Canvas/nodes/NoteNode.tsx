import { useEffect, useMemo } from 'react'
import { Handle, Position, NodeResizer, useUpdateNodeInternals, type NodeProps } from '@xyflow/react'
import { useAppStore } from '../../../../store/useAppStore'
import { Icon } from '../../../../icons/Icon'
import type { CanvasNoteData } from '../../../../types'

const HANDLE_STYLE: React.CSSProperties = {
  width: 14, height: 14,
  background: 'rgb(var(--accent))',
  border: '2px solid rgb(var(--surface))',
  borderRadius: '50%',
  cursor: 'crosshair',
  zIndex: 10,
}

interface NoteNodeData extends CanvasNoteData {
  canvasId: string
  collapsed?: boolean
  onDelete: (id: string) => void
  onOpenNote: (id: string) => void
  onDataChange: (id: string, patch: Record<string, unknown>) => void
}

export function NoteNode({ id, data, selected }: NodeProps & { data: NoteNodeData }) {
  const notes               = useAppStore(s => s.notes)
  const note                = useMemo(() => notes.find(n => n.id === data.noteId), [notes, data.noteId])
  const collapsed           = !!data.collapsed
  const updateNodeInternals = useUpdateNodeInternals()

  // Tell ReactFlow to recompute handle positions whenever collapsed state changes
  useEffect(() => { updateNodeInternals(id) }, [collapsed, id, updateNodeInternals])

  const preview = note?.content
    ? note.content.replace(/^#+\s.*/gm, '').replace(/[*`[\]#>]/g, '').trim().slice(0, 300)
    : null

  return (
    <div className={`relative flex flex-col rounded-xl border shadow-md transition-shadow ${
      collapsed ? 'h-auto' : 'h-full min-h-[140px]'
    } min-w-[220px] ${
      selected ? 'border-[rgb(var(--accent))] shadow-[0_0_0_2px_rgba(var(--accent),0.2)]' : 'border-[rgb(var(--border))]'
    }`}>
      <NodeResizer minWidth={220} minHeight={collapsed ? 36 : 140} isVisible={selected && !collapsed}
        lineStyle={{ borderColor: 'rgb(var(--accent))' }} handleStyle={{ borderColor: 'rgb(var(--accent))', zIndex: 20 }} />

      <Handle type="source" position={Position.Top}    id="t" style={HANDLE_STYLE} />
      <Handle type="source" position={Position.Bottom} id="b" style={HANDLE_STYLE} />
      <Handle type="source" position={Position.Left}   id="l" style={HANDLE_STYLE} />
      <Handle type="source" position={Position.Right}  id="r" style={HANDLE_STYLE} />

      <div className={`flex flex-1 flex-col overflow-hidden rounded-xl bg-[rgb(var(--surface))]`}>
        {/* Drag handle */}
        <div className="drag-handle flex h-7 shrink-0 cursor-grab select-none items-center justify-between border-b border-[rgb(var(--border))] px-2.5 active:cursor-grabbing">
          <div className="flex min-w-0 items-center gap-1.5">
            <Icon name="grip-vertical" size={11} className="shrink-0 text-[rgb(var(--text-3))]" />
            <Icon name="file-text" size={11} className="shrink-0 text-[rgb(var(--accent))]" />
            <span className="truncate text-[11px] font-semibold text-[rgb(var(--text))]">
              {note?.title || data.noteTitle || 'Untitled'}
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-0.5">
            <button type="button" title={collapsed ? 'Expand' : 'Collapse'}
              onPointerDown={e => e.stopPropagation()}
              onClick={() => data.onDataChange(id, { collapsed: !collapsed })}
              className="nodrag nopan flex h-5 w-5 items-center justify-center rounded text-[rgb(var(--text-3))] opacity-40 transition hover:text-[rgb(var(--text))] hover:opacity-100">
              <Icon name={collapsed ? 'chevron-down' : 'chevron-up'} size={11} />
            </button>
            <button type="button" title="Open note"
              onPointerDown={e => e.stopPropagation()}
              onClick={() => data.onOpenNote(data.noteId)}
              className="nodrag nopan flex h-5 w-5 items-center justify-center rounded text-[rgb(var(--text-3))] opacity-40 transition hover:text-[rgb(var(--text))] hover:opacity-100">
              <Icon name="arrow-up-right" size={11} />
            </button>
            <button type="button" title="Remove"
              onPointerDown={e => e.stopPropagation()}
              onClick={() => data.onDelete(id)}
              className="nodrag nopan flex h-5 w-5 items-center justify-center rounded text-[rgb(var(--text-3))] opacity-40 transition hover:text-red-400 hover:opacity-100">
              <Icon name="x" size={11} />
            </button>
          </div>
        </div>

        {!collapsed && (
          <div className="nodrag nopan flex-1 overflow-hidden p-2.5">
            {note
              ? <p className="line-clamp-[8] text-[12px] leading-relaxed text-[rgb(var(--text-2))]">
                  {preview || <span className="italic text-[rgb(var(--text-3))]">Empty note</span>}
                </p>
              : <p className="text-[12px] italic text-[rgb(var(--text-3))]">Note not found</p>
            }
          </div>
        )}
      </div>
    </div>
  )
}
