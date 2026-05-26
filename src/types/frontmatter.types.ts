export type FrontmatterFieldType = 'text' | 'number' | 'date' | 'checkbox' | 'list' | 'note-link'

export type FrontmatterField = {
  key: string
  value: string | number | boolean | string[]
  type: FrontmatterFieldType
}

export type FrontmatterPanelMode = 'visual' | 'yaml'
