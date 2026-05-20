export type Note = {
  id: string
  title: string
  content: string
  tags: string[]
  embedding: number[]
  createdAt: string
  updatedAt: string
  folder?: string  // vault-relative path: "Projects/Work", "" or undefined = root
}

export type TagRecord = {
  name: string
  color: string
  createdAt: string
}
