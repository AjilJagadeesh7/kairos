import { useState, useRef } from 'react'
import { toast } from 'sonner'

import { useKanbanStore } from '../../../../store/useKanbanStore'
import type { KanbanTask } from '../../../../types/kanban.types'
import { v4 as uuidv4 } from 'uuid'
import { Icon } from '../../../../icons/Icon'

interface TaskAttachmentsProps {
  boardId: string
  task: KanbanTask
}

const MAX_FILE_SIZE = 2 * 1024 * 1024
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

export function TaskAttachments({ boardId, task }: TaskAttachmentsProps): JSX.Element {
  const [isDragover, setIsDragover] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const addAttachment    = useKanbanStore(s => s.addAttachment)
  const deleteAttachment = useKanbanStore(s => s.deleteAttachment)
  const attachments      = task.attachments ?? []

  const handleFileSelect = async (files: FileList | null) => {
    if (!files) return
    for (const file of Array.from(files)) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        toast.error(`"${file.name}" is not supported`, { description: 'Only JPEG, PNG, GIF, and WebP images are allowed.' })
        continue
      }
      if (file.size > MAX_FILE_SIZE) {
        toast.error(`"${file.name}" is too large`, { description: 'Attachments must be under 2 MB.' })
        continue
      }
      try {
        const data = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => resolve(reader.result as string)
          reader.onerror = reject
          reader.readAsDataURL(file)
        })
        addAttachment(boardId, task.id, {
          id: uuidv4(), name: file.name, type: file.type,
          size: file.size, data, createdAt: new Date().toISOString(),
        })
      } catch { /* skip */ }
    }
  }

  return (
    <section
      className={`mb-5 rounded-xl transition-colors ${isDragover ? 'bg-[rgb(var(--accent))]/5 ring-2 ring-[rgb(var(--accent))]/40' : ''}`}
      onDrop={e => { e.preventDefault(); setIsDragover(false); void handleFileSelect(e.dataTransfer.files) }}
      onDragOver={e => { e.preventDefault(); setIsDragover(true) }}
      onDragLeave={() => setIsDragover(false)}
    >
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[rgb(var(--text-3))]">
          Attachments {attachments.length > 0 && <span className="ml-1 font-normal normal-case">({attachments.length})</span>}
        </h3>
        <button
          onClick={() => fileInputRef.current?.click()}
          title="Add image"
          className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[10px] font-medium text-[rgb(var(--text-3))] transition hover:bg-[rgb(var(--surface-2))] hover:text-[rgb(var(--accent))]"
        >
          <Icon name="plus" size={11} />
          Add
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept={ALLOWED_TYPES.join(',')}
        onChange={e => void handleFileSelect(e.target.files)}
        className="hidden"
      />

      {attachments.length === 0 ? (
        <p className="text-[11px] text-[rgb(var(--text-3))]">
          Drop images here or use <span className="text-[rgb(var(--accent))]">+ Add</span> above
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {attachments.map(att => (
            <div
              key={att.id}
              className="group relative aspect-square overflow-hidden rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))]"
            >
              <img src={att.data} alt={att.name} className="h-full w-full object-cover" />
              <div className="absolute inset-0 flex items-center justify-center gap-1 bg-black/0 transition-colors group-hover:bg-black/45">
                <a
                  href={att.data}
                  download={att.name}
                  className="rounded-md bg-white/90 p-1.5 opacity-0 transition-opacity hover:bg-white group-hover:opacity-100"
                  title="Download"
                >
                  <Icon name="download" size={12} className="text-black" />
                </a>
                <button
                  onClick={() => deleteAttachment(boardId, task.id, att.id)}
                  className="rounded-md bg-white/90 p-1.5 opacity-0 transition-opacity hover:bg-white group-hover:opacity-100"
                  title="Remove"
                >
                  <Icon name="x" size={12} className="text-black" />
                </button>
              </div>
              <p className="absolute bottom-0 left-0 right-0 truncate bg-black/50 px-1.5 py-0.5 text-[10px] text-white">
                {att.name}
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
