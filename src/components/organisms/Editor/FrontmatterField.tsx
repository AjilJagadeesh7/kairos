import { useEffect, useMemo, useRef, useState } from 'react'
import { useAppStore } from '../../../store/useAppStore'
import { Icon } from '../../../icons/Icon'
import { IconButton } from '../../atoms/IconButton'
import { ToggleSwitch } from '../../atoms/ToggleSwitch'
import type { FrontmatterField, FrontmatterFieldType } from '../../../types'
import type { IconToken } from '../../../icons/tokens'

const TYPE_ICON: Record<FrontmatterFieldType, IconToken> = {
  text:        'type',
  number:      'hash',
  date:        'calendar',
  checkbox:    'check-square',
  list:        'list',
  'note-link': 'link-2',
}

interface Props {
  field: FrontmatterField
  onSetValue: (key: string, value: FrontmatterField['value']) => void
  onRename:   (oldKey: string, newKey: string) => void
  onRemove:   (key: string) => void
}

export function FrontmatterFieldRow({ field, onSetValue, onRename, onRemove }: Props) {
  const [keyDraft, setKeyDraft]     = useState(field.key)
  const [listInput, setListInput]   = useState('')
  const [noteQuery, setNoteQuery]   = useState('')
  const [noteOpen, setNoteOpen]     = useState(false)
  const noteInputRef = useRef<HTMLInputElement>(null)

  // Return a stable string so useSyncExternalStore never sees a new-reference "change"
  const noteTitlesStr = useAppStore(s => s.notes.map(n => n.title).join('\0'))
  const suggestions = useMemo(() => {
    const q = noteQuery.toLowerCase()
    return noteTitlesStr
      ? noteTitlesStr.split('\0').filter(t => t.toLowerCase().includes(q)).slice(0, 8)
      : []
  }, [noteTitlesStr, noteQuery])

  // Sync key draft when field key changes externally
  useEffect(() => { setKeyDraft(field.key) }, [field.key])

  const commitKey = () => {
    const trimmed = keyDraft.trim()
    if (trimmed && trimmed !== field.key) onRename(field.key, trimmed)
    else setKeyDraft(field.key)
  }

  const listItems = Array.isArray(field.value) ? field.value as string[] : []
  const addListItem = () => {
    const v = listInput.trim()
    if (!v) return
    onSetValue(field.key, [...listItems, v])
    setListInput('')
  }

  const noteValue = typeof field.value === 'string' ? field.value : ''
  const displayNoteTitle = noteValue.replace(/^\[\[/, '').replace(/\]\]$/, '')

  return (
    <div className="group flex min-h-[32px] items-start gap-2 rounded-lg px-2 py-1 hover:bg-surface2">
      {/* Type icon */}
      <span className="mt-1.5 shrink-0 text-text3">
        <Icon name={TYPE_ICON[field.type]} size={13} />
      </span>

      {/* Key (editable label) */}
      <input
        value={keyDraft}
        onChange={e => setKeyDraft(e.target.value)}
        onBlur={commitKey}
        onKeyDown={e => { if (e.key === 'Enter') { e.currentTarget.blur() } }}
        className="w-28 shrink-0 rounded bg-transparent px-1 py-0.5 text-xs font-medium text-text2 outline-none focus:bg-surface3 focus:text-text"
        aria-label="Property key"
      />

      {/* Value input — varies by type */}
      <div className="min-w-0 flex-1">
        {field.type === 'checkbox' && (
          <div className="flex h-7 items-center">
            <ToggleSwitch
              checked={typeof field.value === 'boolean' ? field.value : false}
              onChange={v => onSetValue(field.key, v)}
              size="sm"
            />
          </div>
        )}

        {field.type === 'text' && (
          <input
            type="text"
            value={typeof field.value === 'string' ? field.value : ''}
            onChange={e => onSetValue(field.key, e.target.value)}
            className="h-7 w-full rounded bg-transparent px-1 py-0.5 text-xs text-text outline-none focus:bg-surface3"
            placeholder="Empty"
          />
        )}

        {field.type === 'number' && (
          <input
            type="number"
            value={typeof field.value === 'number' ? field.value : ''}
            onChange={e => onSetValue(field.key, e.target.valueAsNumber)}
            className="h-7 w-full rounded bg-transparent px-1 py-0.5 text-xs text-text outline-none focus:bg-surface3"
            placeholder="0"
          />
        )}

        {field.type === 'date' && (
          <input
            type="date"
            value={typeof field.value === 'string' ? field.value : ''}
            onChange={e => onSetValue(field.key, e.target.value)}
            className="h-7 rounded bg-transparent px-1 py-0.5 text-xs text-text outline-none focus:bg-surface3"
          />
        )}

        {field.type === 'list' && (
          <div className="flex flex-wrap items-center gap-1 py-0.5">
            {listItems.map(item => (
              <span key={item} className="inline-flex items-center gap-0.5 rounded-md bg-surface3 px-1.5 py-0.5 text-[11px] text-text2">
                {item}
                <button
                  type="button"
                  onClick={() => onSetValue(field.key, listItems.filter(i => i !== item))}
                  className="ml-0.5 text-text3 hover:text-text"
                  aria-label={`Remove ${item}`}
                >×</button>
              </span>
            ))}
            <input
              type="text"
              value={listInput}
              onChange={e => setListInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addListItem() }
              }}
              placeholder="Add item…"
              className="h-5 min-w-[80px] flex-1 rounded bg-transparent px-1 text-xs text-text outline-none focus:bg-surface3"
            />
          </div>
        )}

        {field.type === 'note-link' && (
          <div className="relative">
            <input
              ref={noteInputRef}
              type="text"
              value={noteOpen ? noteQuery : displayNoteTitle}
              onChange={e => { setNoteQuery(e.target.value); setNoteOpen(true) }}
              onFocus={() => { setNoteQuery(''); setNoteOpen(true) }}
              onBlur={() => setTimeout(() => setNoteOpen(false), 150)}
              placeholder="Search note…"
              className="h-7 w-full rounded bg-transparent px-1 py-0.5 text-xs text-accent outline-none focus:bg-surface3"
            />
            {noteOpen && suggestions.length > 0 && (
              <div className="absolute left-0 top-8 z-50 w-48 overflow-hidden rounded-lg border border-border bg-surface shadow-lg">
                {suggestions.map(title => (
                  <button
                    key={title}
                    type="button"
                    onMouseDown={e => {
                      e.preventDefault()
                      onSetValue(field.key, `[[${title}]]`)
                      setNoteOpen(false)
                    }}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-text2 hover:bg-surface2"
                  >
                    <Icon name="file-text" size={11} className="shrink-0 text-accent" />
                    <span className="truncate">{title}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Delete button — visible on hover */}
      <IconButton
        icon="x"
        label={`Remove ${field.key}`}
        size="xs"
        onClick={() => onRemove(field.key)}
        className="mt-0.5 opacity-0 group-hover:opacity-100"
      />
    </div>
  )
}
