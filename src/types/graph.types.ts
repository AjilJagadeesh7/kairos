export type EdgeKind = 'wikilink' | 'semantic' | 'tag' | 'task-note' | 'task-task'

export type NodeType = 'note' | 'task'

export type GraphEdge = {
  id?: string
  source: string
  target: string
  kind: EdgeKind
  weight?: number
}

export type GNode = {
  id: string
  label: string
  color: string
  val: number
  tags: string[]
  nodeType: NodeType
  taskId?: string
  boardId?: string
  x?: number; y?: number; fx?: number; fy?: number
}

export type GLink = {
  source: string | GNode
  target: string | GNode
  kind: EdgeKind
  sharedTags?: string[]
}

export type GraphPopover = { noteId: string; x: number; y: number }
