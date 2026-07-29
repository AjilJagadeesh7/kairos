export type CanvasNodeType = 'text' | 'note' | 'attachment'

export interface CanvasTextData {
  text: string
  color?: string
  [key: string]: unknown
}

export interface CanvasNoteData {
  noteId: string
  noteTitle: string
  [key: string]: unknown
}

/** A file from the attachments library placed on the board — document, image,
 *  video or audio. The bytes live in the attachment record; the node only
 *  references it by id. */
export interface CanvasAttachmentData {
  attachmentId: string
  /** Snapshot of the filename so a node still reads sensibly if the file is gone. */
  name?: string
  [key: string]: unknown
}

export type CanvasNodeData = CanvasTextData | CanvasNoteData | CanvasAttachmentData

export interface CanvasNode {
  id: string
  type: CanvasNodeType
  position: { x: number; y: number }
  data: CanvasNodeData
  width?: number
  height?: number
}

export interface CanvasEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string | null
  targetHandle?: string | null
  label?: string
  animated?: boolean
}

export interface Canvas {
  id: string
  title: string
  nodes: CanvasNode[]
  edges: CanvasEdge[]
  createdAt: string
  updatedAt: string
  noSync?: boolean  // when true, this canvas stays local-only (never pushed to remotes)
}
