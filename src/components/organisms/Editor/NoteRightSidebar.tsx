import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../../../store/useAppStore'
import { useBacklinks } from '../../../hooks/useBacklinks'
import { TagSelector } from '../../molecules/TagSelector'
import { TagBadge } from '../../atoms/TagBadge'
import { FrontmatterPanel } from './FrontmatterPanel'
import { NoteInfoPanel } from './NoteInfoPanel'
import { Icon } from '../../../icons/Icon'
import { SectionLabel } from '../../atoms/SectionLabel'
import type { Note, TagRecord } from '../../../types'

interface Props {
  note: Note
  content: string
  title: string
  tags: string[]
  tagMap: Map<string, TagRecord>
  allTags: TagRecord[]
  onTagsChange: (tags: string[]) => Promise<void>
  onTagCreate: (name: string, color: string) => void
}

function BacklinksSection({ title }: { title: string }) {
  const notes    = useAppStore(s => s.notes)
  const navigate = useNavigate()
  const backlinks = useBacklinks(title, notes)

  return (
    <div>
      <SectionLabel className="px-3 pt-3 pb-1">
        Backlinks
        {backlinks.length > 0 && (
          <span className="ml-1.5 rounded-full bg-surface3 px-1.5 py-0.5 text-[10px] font-normal normal-case tracking-normal">
            {backlinks.length}
          </span>
        )}
      </SectionLabel>

      <div className="px-2 pb-2">
        {backlinks.length === 0 ? (
          <p className="px-1 text-xs italic text-text3">No notes link here yet.</p>
        ) : (
          <ul className="space-y-1.5">
            {backlinks.map(({ note, context }) => (
              <li key={note.id}>
                <button
                  type="button"
                  onClick={() => navigate(`/notes/${note.id}`)}
                  className="group w-full rounded-lg border border-border bg-surface2 px-3 py-2 text-left transition hover:border-accent/40"
                >
                  <p className="text-xs font-medium text-text group-hover:text-accent transition-colors">
                    {note.title || 'Untitled note'}
                  </p>
                  {context && (
                    <p className="mt-0.5 line-clamp-2 text-[11px] text-text3">{context}</p>
                  )}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

export function NoteRightSidebar({
  note, content, title, tags, tagMap, allTags, onTagsChange, onTagCreate,
}: Props) {
  return (
    <aside
      className="flex h-full w-full flex-col overflow-y-auto bg-surface"
      aria-label="Note sidebar"
    >
      {/* ── Tags ─────────────────────────────────────────────────────────── */}
      <div className="border-b border-border">
        <SectionLabel className="px-3 pt-3 pb-1">Tags</SectionLabel>
        <div className="px-2 pb-2 space-y-1.5">
          <TagSelector
            selectedTags={tags}
            onTagsChange={onTagsChange}
            onTagCreate={onTagCreate}
            availableTags={allTags}
          />
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1 px-1">
              {tags.map(tagName => {
                const tag = tagMap.get(tagName)
                return tag ? (
                  <TagBadge
                    key={tagName}
                    tag={tag}
                    variant="sm"
                    onRemove={() => void onTagsChange(tags.filter(t => t !== tagName))}
                  />
                ) : null
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Backlinks ─────────────────────────────────────────────────────── */}
      <div className="border-b border-border">
        <BacklinksSection title={title} />
      </div>

      {/* ── Properties ───────────────────────────────────────────────────── */}
      <div className="border-b border-border px-2 py-2">
        <FrontmatterPanel note={note} />
      </div>

      {/* ── Note Info ─────────────────────────────────────────────────────── */}
      <div className="px-2 py-2">
        <NoteInfoPanel note={note} content={content} />
      </div>

      {/* ── Outgoing links count at very bottom ──────────────────────────── */}
      <div className="mt-auto border-t border-border px-3 py-2">
        <p className="flex items-center gap-1.5 text-[11px] text-text3">
          <Icon name="external-link" size={11} />
          {note.id ? 'ID: ' + note.id.slice(0, 8) + '…' : ''}
        </p>
      </div>
    </aside>
  )
}
