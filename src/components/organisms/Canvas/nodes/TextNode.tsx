import { useCallback } from 'react'
import { Handle, Position, NodeResizer, type NodeProps } from '@xyflow/react'
import { Icon } from '../../../../icons/Icon'
import type { CanvasTextData } from '../../../../types'

const HANDLE_STYLE: React.CSSProperties = {
  width: 14, height: 14,
  background: 'rgb(var(--accent))',
  border: '2px solid rgb(var(--surface))',
  borderRadius: '50%',
  cursor: 'crosshair',
  zIndex: 10,
}

interface TextNodeData extends CanvasTextData {
  canvasId: string
  onDelete: (id: string) => void
  onDataChange: (id: string, patch: Record<string, unknown>) => void
}

export function TextNode({ id, data, selected }: NodeProps & { data: TextNodeData }) {
  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    data.onDataChange(id, { text: e.target.value })
  }, [id, data])

  return (
    <div className={`relative flex h-full min-h-[120px] min-w-[200px] flex-col rounded-xl border shadow-md transition-shadow ${
      selected ? 'border-[rgb(var(--accent))] shadow-[0_0_0_2px_rgba(var(--accent),0.2)]' : 'border-[rgb(var(--border))]'
    }`}>
      <NodeResizer minWidth={200} minHeight={120} isVisible={selected} lineStyle={{ borderColor: 'rgb(var(--accent))' }} handleStyle={{ borderColor: 'rgb(var(--accent))', zIndex: 20 }} />

      <Handle type="source" position={Position.Top}    id="t" style={HANDLE_STYLE} />
      <Handle type="source" position={Position.Bottom} id="b" style={HANDLE_STYLE} />
      <Handle type="source" position={Position.Left}   id="l" style={HANDLE_STYLE} />
      <Handle type="source" position={Position.Right}  id="r" style={HANDLE_STYLE} />

      {/* Inner wrapper clips content to rounded corners without clipping resize handles */}
      <div className="flex flex-1 flex-col overflow-hidden rounded-xl bg-[rgb(var(--surface))]"
        style={data.color ? { background: data.color } : undefined}>
        {/* Drag handle — only this zone initiates node dragging */}
        <div className="drag-handle flex h-7 shrink-0 cursor-grab select-none items-center justify-between border-b border-[rgb(var(--border))] px-2.5 active:cursor-grabbing">
          <div className="flex items-center gap-1.5">
            <Icon name="grip-vertical" size={11} className="text-[rgb(var(--text-3))]" />
            <span className="text-[10px] font-semibold uppercase tracking-wider text-[rgb(var(--text-3))]">Text</span>
          </div>
          <button type="button" title="Delete"
            onPointerDown={e => e.stopPropagation()}
            onClick={() => data.onDelete(id)}
            className="nodrag nopan flex h-5 w-5 items-center justify-center rounded text-[rgb(var(--text-3))] opacity-40 transition hover:text-red-400 hover:opacity-100">
            <Icon name="x" size={12} />
          </button>
        </div>

        <textarea
          value={data.text ?? ''}
          onChange={handleChange}
          onPointerDown={e => e.stopPropagation()}
          placeholder="Type something…"
          className="nodrag nopan flex-1 resize-none bg-transparent p-2.5 text-[13px] leading-relaxed text-[rgb(var(--text))] outline-none placeholder:text-[rgb(var(--text-3))]"
        />
      </div>
    </div>
  )
}
