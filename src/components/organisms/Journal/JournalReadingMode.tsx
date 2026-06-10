import { MarkdownEditor } from '../Editor/MarkdownEditor'
import { AnnotationLayer } from '../Editor/Annotations/AnnotationLayer'

interface JournalReadingModeProps {
  date: string
  label: string
  content: string
}

/** Read-only rendered view of a journal entry, mirroring the Notes reading mode
 *  by reusing MarkdownEditor in readOnly mode. */
export function JournalReadingMode({ date, label, content }: JournalReadingModeProps) {
  return (
    <div className="h-full overflow-y-auto p-4">
      <h1 className="mb-4 text-2xl font-bold leading-tight text-[rgb(var(--text))]">{label}</h1>
      <div className="reading-view">
        <AnnotationLayer docId={date}>
          <MarkdownEditor
            key={`reading-${date}`}
            noteId={date}
            initialMarkdown={content}
            noteTitle={label}
            readOnly
            onChange={() => {}}
          />
        </AnnotationLayer>
      </div>
    </div>
  )
}
