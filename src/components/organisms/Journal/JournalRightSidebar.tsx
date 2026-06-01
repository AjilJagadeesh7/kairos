import { JournalBacklinksPanel } from './JournalBacklinksPanel'

interface JournalRightSidebarProps {
  date: string
  label: string
}

/** Right sidebar for the journal editor, mirroring NoteRightSidebar.
 *  Notes can wikilink to a day, so we surface backlinks here. */
export function JournalRightSidebar({ date, label }: JournalRightSidebarProps) {
  return (
    <aside
      className="flex h-full w-full flex-col overflow-y-auto bg-surface"
      aria-label="Journal sidebar"
    >
      <div className="border-b border-border">
        <JournalBacklinksPanel date={date} label={label} />
      </div>
    </aside>
  )
}
