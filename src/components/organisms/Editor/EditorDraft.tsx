import { useRef, useState } from 'react'

import { useNoteDraft } from '../../../hooks/useNoteDraft'
import { useConflictStore } from '../../../store/useConflictStore'
import { EditorToolbar } from './EditorToolbar'
import { SlotRenderer } from '../../molecules/SlotRenderer'
import { EditorBannerArea } from './EditorBannerArea'
import { EditorReadingMode } from './EditorReadingMode'
import { EditorDraftSidebar } from './EditorDraftSidebar'
import { MarkdownEditor } from './MarkdownEditor'
import { HistoryPanel } from './HistoryPanel'
import { ConflictBanner } from './ConflictBanner'
import { Icon } from '../../../icons/Icon'
import type { EditorDraftProps } from '../../../types'

export function EditorDraft({ note, onSave }: EditorDraftProps): JSX.Element {
  const draft    = useNoteDraft({ note, onSave })
  const conflict = useConflictStore(s => s.conflicts.find(c => c.noteId === note.id))

  // On mobile the sidebar is an overlay drawer — start closed so content is the hero.
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth >= 768)
  const editorRootRef = useRef<HTMLDivElement>(null)

  return (
    <section className="relative flex h-full flex-col bg-bg">
      {conflict && (
        <ConflictBanner
          conflict={conflict}
          onApplyRemote={(newContent, newTitle) => { draft.setContent(newContent); draft.setTitle(newTitle) }}
        />
      )}

      {draft.readingMode ? (
        <EditorReadingMode
          note={note} title={draft.title} content={draft.content} restoreKey={draft.restoreKey}
          tags={draft.tags} tagMap={draft.tagMap} editorRootRef={editorRootRef}
          onExitReadingMode={() => draft.setReadingMode(false)}
          onContentChange={draft.setContent}
          onWikilinkClick={draft.handleWikilinkClick}
        />
      ) : (
        <div className="flex h-full flex-col overflow-hidden">
          <EditorToolbar
            note={note}
            noteTitle={draft.title}
            saveStatus={draft.saveStatus}
            onSave={() => void draft.saveNote()}
            showHistory={draft.showHistory}
            onToggleHistory={() => draft.setShowHistory(h => !h)}
            onReadingMode={() => draft.setReadingMode(true)}
            onDelete={draft.handleDeleteNote}
            sidebarOpen={sidebarOpen}
            onToggleSidebar={() => setSidebarOpen(v => !v)}
          />

          <div className="flex flex-1 min-h-0 overflow-hidden">
            {/* ── Main writing area ─────────────────────────────────────── */}
            {/* No overflow here — .ProseMirror is the scroll container (see index.css).
                min-h-0 lets the flex chain constrain ProseMirror's height so it scrolls. */}
            <div className="flex flex-1 min-h-0 flex-col">
              <div ref={editorRootRef} className="flex flex-1 min-h-0 flex-col p-2">
                {/* Pre-editor elements — shrink-0 so they don't compete with the editor for height.
                    px-11 matches the ProseMirror content padding below so the title aligns with the
                    body; the gutter is sized to fit Crepe's block (drag) handle on the left. */}
                <div className="shrink-0 px-11">
                  <EditorBannerArea
                    note={note}
                    onUpdateFrontmatter={fm => void draft.updateNoteFrontmatter(note.id, fm)}
                  />

                  {draft.isLargeNote && (
                    <div className="mb-3 flex items-center gap-2 rounded-xl border border-amber-400/40 bg-amber-50/60 px-3 py-2 dark:bg-amber-950/20">
                      <Icon name="alert-triangle" size={13} className="shrink-0 text-amber-500" />
                      <p className="flex-1 text-[11px] text-amber-700 dark:text-amber-400">
                        This note is large (&gt;150 KB). The editor may be slower — consider splitting it.
                      </p>
                      <button type="button" onClick={draft.dismissLargeNote} className="text-amber-500 hover:text-amber-700">
                        <Icon name="x" size={13} />
                      </button>
                    </div>
                  )}

                  <input
                    value={draft.title}
                    onChange={e => draft.setTitle(e.target.value)}
                    className="w-full bg-transparent text-[26px] font-bold leading-tight text-text outline-none placeholder:text-text3"
                    placeholder="Untitled note"
                  />

                  <hr className="my-4 border-border" />
                  <SlotRenderer
                    slot="editor:title:below"
                    props={{ noteId: note.id, noteTitle: draft.title }}
                  />
                </div>

                {/* Editor fills remaining height — ProseMirror scrolls internally */}
                <div className="flex-1 min-h-0">
                  <MarkdownEditor
                    key={draft.restoreKey}
                    noteId={note.id}
                    initialMarkdown={draft.content}
                    noteTitle={draft.title}
                    onChange={draft.setContent}
                    onWikilinkClick={draft.handleWikilinkClick}
                    enableAttachments
                  />
                </div>
              </div>
            </div>

            {sidebarOpen && (
              <EditorDraftSidebar
                note={note}
                content={draft.content}
                title={draft.title}
                tags={draft.tags}
                tagMap={draft.tagMap}
                allTags={draft.allTags}
                onTagsChange={draft.saveTags}
                onTagCreate={(name, color) => draft.setNoteTagColor(name, color)}
                onClose={() => setSidebarOpen(false)}
              />
            )}
          </div>
        </div>
      )}

      {draft.showHistory && (
        <HistoryPanel
          id={note.id}
          type="note"
          onRestore={draft.handleRestore}
          onClose={() => draft.setShowHistory(false)}
        />
      )}
    </section>
  )
}
