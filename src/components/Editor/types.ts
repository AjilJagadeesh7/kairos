import type { Note } from '../../types'

export type EditorDraftProps = {
  note: Note
  onSave: (payload: { title: string; content: string; embedding: number[]; contentHash: string }) => Promise<void>
}

export type MarkdownEditorProps = {
  noteId: string
  initialMarkdown: string
  noteTitle: string
  onChange: (markdown: string) => void
  onWikilinkClick?: (title: string) => void
}

export type TableCommandRunner = {
  call: (slice: unknown, payload?: unknown) => boolean
}

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
}

export const CLOSED_MENU: ContextMenuState = {
  visible: false,
  x: 0,
  y: 0,
  kind: 'default',
  rowIndex: -1,
  colIndex: -1,
  imageSrc: '',
  imageNodePos: -1,
}
