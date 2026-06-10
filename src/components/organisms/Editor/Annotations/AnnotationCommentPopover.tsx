import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useAnnotationStore } from '../../../../store/useAnnotationStore'
import { ANNOTATION_COLORS } from '../../../../types'
import type { Annotation } from '../../../../types'
import { IconButton } from '../../../atoms/IconButton'

interface Props {
  annotation: Annotation
  x: number
  y: number
  onClose: () => void
}

/** View / edit a sticky note's comment, recolor it, or delete the annotation. */
export function AnnotationCommentPopover({ annotation, x, y, onClose }: Props): JSX.Element {
  const setComment = useAnnotationStore(s => s.setComment)
  const setColor = useAnnotationStore(s => s.setColor)
  const remove = useAnnotationStore(s => s.remove)
  const [text, setText] = useState(annotation.comment ?? '')

  const save = () => { setComment(annotation.docId, annotation.id, text); onClose() }

  return createPortal(
    <>
      <div className="fixed inset-0 z-[99]" onClick={save} />
      <div
        className="fixed z-[100] w-72 rounded-xl border border-border bg-bg p-3 shadow-xl"
        style={{ left: Math.min(x, window.innerWidth - 300), top: Math.min(y, window.innerHeight - 200) }}
        onClick={e => e.stopPropagation()}
      >
        <div className="mb-2 flex items-center gap-1">
          {ANNOTATION_COLORS.map(c => (
            <button
              key={c}
              type="button"
              aria-label={`Color ${c}`}
              onClick={() => setColor(annotation.docId, annotation.id, c)}
              className={`h-5 w-5 rounded-full border transition ${annotation.color === c ? 'border-text ring-1 ring-text' : 'border-border'}`}
              style={{ backgroundColor: c }}
            />
          ))}
          <div className="flex-1" />
          <IconButton
            icon="trash-2"
            label="Delete annotation"
            size="sm"
            onClick={() => { remove(annotation.docId, annotation.id); onClose() }}
            className="hover:bg-red-500/10 hover:text-red-400"
          />
        </div>

        <textarea
          autoFocus
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Escape') { e.preventDefault(); save() } }}
          placeholder="Add a note…"
          className="h-24 w-full resize-none rounded-lg border border-border bg-surface p-2 text-sm text-text outline-none focus:border-accent/50"
        />

        <div className="mt-2 flex justify-end">
          <button
            type="button"
            onClick={save}
            className="rounded-md bg-accent/10 px-3 py-1 text-xs font-medium text-accent transition hover:bg-accent/20"
          >
            Done
          </button>
        </div>
      </div>
    </>,
    document.body,
  )
}
