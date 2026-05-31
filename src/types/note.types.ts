export type Note = {
  id: string
  title: string
  content: string
  tags: string[]
  embedding: number[]
  createdAt: string
  updatedAt: string
  folder?: string  // vault-relative path: "Projects/Work", "" or undefined = root
  userFrontmatter?: Record<string, unknown>
  noSync?: boolean  // when true, this note stays local-only (never pushed to remotes)
}

export type TagRecord = {
  name: string
  color: string
  createdAt: string
}

export interface NoteTemplate {
  id: string
  name: string
  description: string
  icon: React.ReactNode
  title: string
  content: string
}
