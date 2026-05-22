import { useState, useRef } from 'react'

import { useKanbanStore } from '../../../../store/useKanbanStore'
import type { KanbanTask } from '../../../../types/kanban.types'
import { v4 as uuidv4 } from 'uuid'
import { Icon } from '../../../../icons/Icon'

interface TaskAttachmentsProps {
  boardId: string
  task: KanbanTask
}

const MAX_FILE_SIZE = 2 * 1024 * 1024 // 2MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

export function TaskAttachments({ boardId, task }: TaskAttachmentsProps): JSX.Element {
  const [isDragover, setIsDragover] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const addAttachment = useKanbanStore(s => s.addAttachment)
  const deleteAttachment = useKanbanStore(s => s.deleteAttachment)

  const handleFileSelect = async (files: FileList | null) => {
    if (!files) return

    for (const file of Array.from(files)) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        alert(`File type not supported. Please use: JPG, PNG, GIF, or WebP`)
        continue
      }

      if (file.size > MAX_FILE_SIZE) {
        alert(`File size exceeds 2MB limit. Please choose a smaller image.`)
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
          id: uuidv4(),
          name: file.name,
          type: file.type,
          size: file.size,
          data,
          createdAt: new Date().toISOString(),
        })
      } catch (err) {
        console.error('Failed to read file:', err)
      }
    }
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragover(false)
    handleFileSelect(e.dataTransfer.files)
  }

  const attachments = task.attachments ?? []

  return (
    <section className="mb-5">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-[rgb(var(--text-3))]">
        Attachments
      </h3>

      {/* Image grid */}
      {attachments.length > 0 && (
        <div className="mb-3 grid grid-cols-3 gap-2">
          {attachments.map(attachment => (
            <div
              key={attachment.id}
              className="group relative aspect-square rounded-lg border border-[rgb(var(--border))] overflow-hidden bg-[rgb(var(--surface-2))]"
            >
              <img
                src={attachment.data}
                alt={attachment.name}
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center gap-1">
                <a
                  href={attachment.data}
                  download={attachment.name}
                  className="opacity-0 group-hover:opacity-100 transition-opacity rounded-md bg-white/90 p-1 hover:bg-white"
                  title="Download"
                >
                  <Icon name="download" size={12} className="text-black" />
                </a>
                <button
                  onClick={() => deleteAttachment(boardId, task.id, attachment.id)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity rounded-md bg-white/90 p-1 hover:bg-white"
                  title="Delete"
                >
                  <Icon name="x" size={12} className="text-black" />
                </button>
              </div>
              <p className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[10px] px-1 py-0.5 truncate">
                {attachment.name}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Upload area */}
      <div
        onDrop={handleDrop}
        onDragover={(e) => { e.preventDefault(); setIsDragover(true) }}
        onDragLeave={() => setIsDragover(false)}
        className={`rounded-lg border-2 border-dashed p-4 text-center transition-colors ${
          isDragover
            ? 'border-[rgb(var(--accent))] bg-[rgb(var(--accent))]/5'
            : 'border-[rgb(var(--border))] bg-[rgb(var(--surface-2))]'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ALLOWED_TYPES.join(',')}
          onChange={(e) => handleFileSelect(e.target.files)}
          className="hidden"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center justify-center gap-2 mx-auto text-xs text-[rgb(var(--text-2))] hover:text-[rgb(var(--text))] transition-colors"
        >
          <Icon name="image" size={14} />
          <span>Click to upload or drag image</span>
        </button>
        <p className="mt-1 text-[10px] text-[rgb(var(--text-3))]">
          Max 2MB · JPG, PNG, GIF, WebP
        </p>
      </div>
    </section>
  )
}
