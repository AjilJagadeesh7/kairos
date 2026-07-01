import type { Note } from './note.types'

export type SaveStatus = 'idle' | 'dirty' | 'saving' | 'saved'

export type MenuKind = 'table' | 'image' | 'text' | 'default'

export type ContextMenuState = {
  visible: boolean
  x: number
  y: number
  kind: MenuKind
  rowIndex: number
  colIndex: number
  imageSrc: string
  imageNodePos: number
  selectedText: string
}

export const CLOSED_MENU: ContextMenuState = {
  visible: false, x: 0, y: 0, kind: 'default',
  rowIndex: -1, colIndex: -1, imageSrc: '', imageNodePos: -1,
  selectedText: '',
}

export type EditorDraftProps = {
  note: Note
  onSave: (payload: { title: string; content: string; embedding: number[]; contentHash: string }) => Promise<void>
}

export type MarkdownEditorProps = {
  noteId: string
  initialMarkdown: string
  noteTitle: string
  readOnly?: boolean
  onChange: (markdown: string) => void
  onWikilinkClick?: (title: string) => void
  /** When true, imported media is stored as standalone attachments (referenced by
   *  `attachment://<id>`); otherwise it is inlined as base64 (e.g. kanban). */
  enableAttachments?: boolean
}

export type TableCommandRunner = {
  call: (slice: unknown, payload?: unknown) => boolean
}
