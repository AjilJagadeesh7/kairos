import { useEffect, useState } from 'react'
import { Handle, Position, NodeResizer, type NodeProps } from '@xyflow/react'
import { Icon } from '../../../../icons/Icon'
import { useAttachmentStore } from '../../../../store/useAttachmentStore'
import { resolveAttachment, kindFromName, downloadAttachment } from '../../../../attachments/attachmentService'
import { formatBytes } from '../../../../tiers/checks'
import { AttachmentNodeMedia } from './AttachmentNodeMedia'
import { KIND_ICON } from '../../../../utils/attachmentIcons'
import type { CanvasAttachmentData } from '../../../../types'

const HANDLE_STYLE: React.CSSProperties = {
  width: 14, height: 14,
  background: 'rgb(var(--accent))',
  border: '2px solid rgb(var(--surface))',
  borderRadius: '50%',
  cursor: 'crosshair',
  zIndex: 10,
}

interface AttachmentNodeData extends CanvasAttachmentData {
  canvasId: string
  onDelete: (id: string) => void
  onDataChange: (id: string, patch: Record<string, unknown>) => void
}

export function AttachmentNode({ id, data, selected }: NodeProps & { data: AttachmentNodeData }) {
  const record = useAttachmentStore(s => s.attachments.find(a => a.id === data.attachmentId))
  const [url, setUrl] = useState<string | null | undefined>(undefined)

  // `undefined` = still resolving, `null` = the file is gone (deleted or not synced yet).
  useEffect(() => {
    let alive = true
    const attachmentId = data.attachmentId
    const pending = attachmentId ? resolveAttachment(attachmentId) : Promise.resolve(null)
    void pending.then(u => { if (alive) setUrl(u) })
    return () => { alive = false }
  }, [data.attachmentId])

  // Keep the display name in step with a rename on the attachments page.
  useEffect(() => {
    if (record && record.name !== data.name) data.onDataChange(id, { name: record.name })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [record?.name])

  const name = record?.name ?? data.name ?? ''
  const kind = kindFromName(name)

  return (
    <div className={`relative flex h-full min-h-[200px] min-w-[240px] flex-col rounded-xl border shadow-md transition-shadow ${
      selected ? 'border-[rgb(var(--accent))] shadow-[0_0_0_2px_rgba(var(--accent),0.2)]' : 'border-[rgb(var(--border))]'
    }`}>
      <NodeResizer minWidth={240} minHeight={200} isVisible={selected} lineStyle={{ borderColor: 'rgb(var(--accent))' }} handleStyle={{ borderColor: 'rgb(var(--accent))', zIndex: 20 }} />

      <Handle type="source" position={Position.Top}    id="t" style={HANDLE_STYLE} />
      <Handle type="source" position={Position.Bottom} id="b" style={HANDLE_STYLE} />
      <Handle type="source" position={Position.Left}   id="l" style={HANDLE_STYLE} />
      <Handle type="source" position={Position.Right}  id="r" style={HANDLE_STYLE} />

      {/* Inner wrapper clips content to rounded corners without clipping resize handles */}
      <div className="flex flex-1 flex-col overflow-hidden rounded-xl bg-[rgb(var(--surface))]">

        {/* Drag handle + filename */}
        <div className="drag-handle flex h-8 shrink-0 cursor-grab select-none items-center gap-1.5 border-b border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] px-2 active:cursor-grabbing">
          <Icon name="grip-vertical"  size={11} className="shrink-0 text-[rgb(var(--text-3))]" />
          <Icon name={KIND_ICON[kind]} size={11} className="shrink-0 text-[rgb(var(--accent))]" />
          <span className="min-w-0 flex-1 truncate text-[11px] text-[rgb(var(--text-2))]" title={name}>
            {name || <span className="italic text-[rgb(var(--text-3))]">Attachment</span>}
          </span>
          {record && (
            <span className="shrink-0 text-[10px] text-[rgb(var(--text-3))]">{formatBytes(record.size)}</span>
          )}

          {record && (
            <button type="button" title="Download"
              onPointerDown={e => e.stopPropagation()}
              onClick={() => void downloadAttachment(record)}
              className="nodrag nopan flex h-5 w-5 shrink-0 items-center justify-center rounded text-[rgb(var(--text-3))] transition hover:text-[rgb(var(--text))]">
              <Icon name="download" size={11} />
            </button>
          )}

          <button type="button" title="Remove"
            onPointerDown={e => e.stopPropagation()}
            onClick={() => data.onDelete(id)}
            className="nodrag nopan flex h-5 w-5 shrink-0 items-center justify-center rounded text-[rgb(var(--text-3))] opacity-40 transition hover:text-red-400 hover:opacity-100">
            <Icon name="x" size={11} />
          </button>
        </div>

        {/* Content */}
        <div className="nodrag nopan relative flex flex-1 items-center justify-center overflow-hidden bg-[rgb(var(--surface-2))]">
          {/* When selected, cover embedded media so resize handles keep the pointer
              events — an iframe/video otherwise swallows mousedown on the border. */}
          {selected && (kind === 'pdf') && <div className="absolute inset-0 z-10" />}
          <AttachmentNodeMedia kind={kind} url={url} name={name} />
        </div>
      </div>
    </div>
  )
}
