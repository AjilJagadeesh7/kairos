export type Note = {
  id: string
  title: string
  content: string
  tags: string[]
  embedding: number[]
  createdAt: string
  updatedAt: string
}

export type TagRecord = {
  name: string
  color: string
  createdAt: string
}
