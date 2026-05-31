export type JournalEntry = {
  date: string      // YYYY-MM-DD — primary key and filename
  content: string
  updatedAt: string
  noSync?: boolean  // when true, this entry stays local-only (never pushed to remotes)
}
