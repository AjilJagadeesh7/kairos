/** The note bubble's prompt menu: built-in presets, grouped. Edits apply to the selection, or the whole note. */
import type { IconToken } from '../../../../icons/tokens'

export type PresetRun =
  | { kind: 'summary' }
  | { kind: 'ask'; prompt: string }
  | { kind: 'edit'; instruction: string }
  | { kind: 'insert'; instruction: string; at: 'cursor' | 'top' | 'end' }
  | { kind: 'title' }
  | { kind: 'tags' }
  | { kind: 'tasks' }

export interface NotePreset {
  id: string
  label: string
  icon: IconToken
  group: 'Ask' | 'Write' | 'Edit' | 'Organize'
  run: PresetRun
}

export const NOTE_PRESETS: NotePreset[] = [
  { id: 'summary', label: 'Summarize', icon: 'scroll-text', group: 'Ask', run: { kind: 'summary' } },
  { id: 'explain', label: 'Explain simply', icon: 'lightbulb', group: 'Ask', run: { kind: 'ask', prompt: 'Explain this in simple terms.' } },
  { id: 'key-points', label: 'Key points', icon: 'list', group: 'Ask', run: { kind: 'ask', prompt: 'What are the key points? Answer as a short bullet list.' } },
  { id: 'gaps', label: 'Gaps & questions', icon: 'info', group: 'Ask', run: { kind: 'ask', prompt: 'What is missing, unclear or worth questioning here? Be specific.' } },

  { id: 'continue', label: 'Continue writing', icon: 'pen-line', group: 'Write', run: { kind: 'insert', instruction: 'Continue writing from here in the same style and voice.', at: 'cursor' } },
  { id: 'brainstorm', label: 'Brainstorm ideas', icon: 'sparkles', group: 'Write', run: { kind: 'insert', instruction: 'Brainstorm more ideas related to this note, as a bullet list under a short heading.', at: 'end' } },
  { id: 'outline', label: 'Draft an outline', icon: 'list-ordered', group: 'Write', run: { kind: 'insert', instruction: 'Draft an outline for this note as headings with a few bullets each.', at: 'top' } },
  { id: 'next-steps', label: 'Add next steps', icon: 'check-square', group: 'Write', run: { kind: 'insert', instruction: 'Add a "Next steps" section with concrete checklist items (- [ ]) based on the note.', at: 'end' } },

  { id: 'tighten', label: 'Tighten', icon: 'strikethrough', group: 'Edit', run: { kind: 'edit', instruction: 'Make it shorter and tighter. Keep every fact, name, number and link; cut filler and repetition.' } },
  { id: 'expand', label: 'Expand', icon: 'layers', group: 'Edit', run: { kind: 'edit', instruction: 'Expand it with more detail and explanation, keeping the facts and structure.' } },
  { id: 'simplify', label: 'Simplify', icon: 'graduation-cap', group: 'Edit', run: { kind: 'edit', instruction: 'Rewrite it in simpler, plain language.' } },
  { id: 'formal', label: 'More formal', icon: 'bold', group: 'Edit', run: { kind: 'edit', instruction: 'Make it more formal and professional. Keep the meaning, facts and structure.' } },
  { id: 'casual', label: 'More casual', icon: 'italic', group: 'Edit', run: { kind: 'edit', instruction: 'Make it more casual and conversational. Keep the meaning and facts.' } },
  { id: 'grammar', label: 'Fix grammar', icon: 'check-circle-2', group: 'Edit', run: { kind: 'edit', instruction: 'Fix spelling, grammar and punctuation only. Change as few words as possible; do not rephrase.' } },
  { id: 'bullets', label: 'Bullet list', icon: 'list-checks', group: 'Edit', run: { kind: 'edit', instruction: 'Turn it into a well-organized bullet list.' } },
  { id: 'table', label: 'Make a table', icon: 'columns-2', group: 'Edit', run: { kind: 'edit', instruction: 'Turn it into a markdown table with sensible columns.' } },
  { id: 'translate-en', label: 'Translate to English', icon: 'globe', group: 'Edit', run: { kind: 'edit', instruction: 'Translate it into English. Keep the formatting.' } },

  { id: 'title', label: 'Suggest a title', icon: 'type', group: 'Organize', run: { kind: 'title' } },
  { id: 'tags', label: 'Suggest tags', icon: 'tag', group: 'Organize', run: { kind: 'tags' } },
  { id: 'tasks', label: 'Make tasks', icon: 'square-kanban', group: 'Organize', run: { kind: 'tasks' } },
]

export const PRESET_GROUPS: NotePreset['group'][] = ['Ask', 'Write', 'Edit', 'Organize']
