export type CanvasNodeType = 'text' | 'note' | 'web'

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

export interface CanvasWebData {
  url: string
  title?: string
  [key: string]: unknown
}

export type CanvasNodeData = CanvasTextData | CanvasNoteData | CanvasWebData

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
}
