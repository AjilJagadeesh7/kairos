import type React from 'react'
import { Dropdown } from '../../molecules/Dropdown'
import { ExportMenu } from './EditorExportMenu'
import { MarkdownEditor } from './MarkdownEditor'
import { AnnotationLayer } from './Annotations/AnnotationLayer'
import { TagBadge } from '../../atoms/TagBadge'
import { Icon } from '../../../icons/Icon'
import type { EditorDraftProps } from '../../../types'
import type { TagRecord } from '../../../types'

interface EditorReadingModeProps {
  note: EditorDraftProps['note']
  title: string
  content: string
  restoreKey: number
  tags: string[]
  tagMap: Map<string, TagRecord>
  editorRootRef: React.RefObject<HTMLDivElement>
  exportingPDF: boolean
  onExportPDF: () => void
  onExitReadingMode: () => void
  onContentChange: (v: string) => void
  onWikilinkClick: (t: string) => void
}

export function EditorReadingMode({
  note, title, content, restoreKey, tags, tagMap,
  editorRootRef, exportingPDF, onExportPDF,
  onExitReadingMode, onContentChange, onWikilinkClick,
}: EditorReadingModeProps) {
  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2 md:px-6">
        <div className="flex flex-wrap gap-1">
          {tags.map((tagName) => {
            const tag = tagMap.get(tagName)
            return tag ? <TagBadge key={tagName} tag={tag} variant="md" /> : null
          })}
        </div>
        <div className="flex items-center gap-2">
          <Dropdown trigger={
            <div className="flex h-[32px] items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 text-xs font-medium text-text3 transition hover:border-accent/50 hover:text-accent">
              <Icon name="share" size={13} />
              <span>Export</span>
              <Icon name="chevron-down" size={11} />
            </div>
          }>
            <ExportMenu note={note} exportingPDF={exportingPDF} onExportPDF={onExportPDF} size="sm" />
          </Dropdown>
          <button
            type="button"
            title="Switch to edit mode (Esc)"
            onClick={onExitReadingMode}
            className="flex h-[32px] items-center gap-1.5 rounded-md border border-accent/40 bg-accent/10 px-2.5 text-xs font-medium text-accent transition hover:bg-accent/20"
          >
            <Icon name="pencil" size={13} />
            <span>Edit</span>
          </button>
        </div>
      </div>

      <div ref={editorRootRef} className="min-h-0 flex-1 overflow-y-auto">
        {!!note.userFrontmatter?.banner && (
          <div className="h-48 overflow-hidden">
            <img
              src={note.userFrontmatter.banner as string}
              alt=""
              className="w-full h-full object-cover"
              style={{
                objectPosition: `${((note.userFrontmatter.banner_x as number) ?? 0.5) * 100}% ${((note.userFrontmatter.banner_y as number) ?? 0.5) * 100}%`,
              }}
            />
          </div>
        )}
        <div className="p-4">
        <h1 className="mb-4 text-2xl font-bold leading-tight text-text">{title || 'Untitled note'}</h1>
        <div className="reading-view">
          <AnnotationLayer docId={note.id}>
            <MarkdownEditor
              key={restoreKey}
              noteId={note.id}
              initialMarkdown={content}
              noteTitle={title}
              readOnly
              onChange={onContentChange}
              onWikilinkClick={onWikilinkClick}
            />
          </AnnotationLayer>
        </div>
        </div>
      </div>
    </div>
  )
}
