import { useRef, useState } from 'react'
import * as yaml from 'js-yaml'
import { useFrontmatter } from '../../../hooks/useFrontmatter'
import { Icon } from '../../../icons/Icon'
import { Button } from '../../atoms/Button'
import { IconButton } from '../../atoms/IconButton'
import { FrontmatterFieldRow } from './FrontmatterField'
import type { FrontmatterFieldType, FrontmatterPanelMode } from '../../../types'
import type { Note } from '../../../types'

const FIELD_TYPES: { type: FrontmatterFieldType; label: string }[] = [
  { type: 'text',      label: 'Text' },
  { type: 'number',    label: 'Number' },
  { type: 'date',      label: 'Date' },
  { type: 'checkbox',  label: 'Checkbox' },
  { type: 'list',      label: 'List' },
  { type: 'note-link', label: 'Note link' },
]

interface Props {
  note: Note
}

export function FrontmatterPanel({ note }: Props) {
  const { fields, setField, removeField, renameField, addField, setRaw } = useFrontmatter(
    note.id,
    note.userFrontmatter,
  )

  const [mode, setMode]           = useState<FrontmatterPanelMode>('visual')
  const [collapsed, setCollapsed] = useState(true)
  const [addOpen, setAddOpen]     = useState(false)
  const [newKey, setNewKey]       = useState('')
  const [newType, setNewType]     = useState<FrontmatterFieldType>('text')
  const [rawText, setRawText]     = useState('')
  const [rawError, setRawError]   = useState('')
  const newKeyRef = useRef<HTMLInputElement>(null)

  const openAdd = () => {
    setNewKey('')
    setAddOpen(true)
    setTimeout(() => newKeyRef.current?.focus(), 0)
  }

  const commitAdd = () => {
    const k = newKey.trim()
    if (!k) { setAddOpen(false); return }
    addField(k, newType)
    setAddOpen(false)
    setNewKey('')
  }

  const enterYaml = () => {
    const obj = note.userFrontmatter ?? {}
    try {
      setRawText(yaml.dump(obj, { lineWidth: -1 }))
    } catch {
      setRawText('')
    }
    setRawError('')
    setMode('yaml')
  }

  const commitYaml = () => {
    try {
      const parsed = yaml.load(rawText, { schema: yaml.JSON_SCHEMA })
      if (parsed !== null && typeof parsed !== 'object') {
        setRawError('Must be a YAML mapping (key: value pairs)')
        return
      }
      setRaw((parsed as Record<string, unknown>) ?? {})
      setRawError('')
      setMode('visual')
    } catch (err) {
      setRawError(err instanceof Error ? err.message : 'Invalid YAML')
    }
  }

  const hasFields = fields.length > 0

  return (
    <div className="mb-2 rounded-lg border border-border bg-surface">
      {/* Header */}
      <div className="flex items-center gap-1 px-3 py-1.5">
        <button
          type="button"
          onClick={() => setCollapsed(v => !v)}
          className="flex flex-1 items-center gap-1.5 text-left"
          aria-expanded={!collapsed}
        >
          <Icon
            name="chevron-right"
            size={13}
            className={`shrink-0 text-text3 transition-transform ${collapsed ? '' : 'rotate-90'}`}
          />
          <span className="text-xs font-semibold uppercase tracking-widest text-text3">Properties</span>
          {hasFields && (
            <span className="ml-1 rounded-full bg-surface3 px-1.5 py-0.5 text-[10px] text-text3">
              {fields.length}
            </span>
          )}
        </button>

        {!collapsed && (
          <div className="flex items-center gap-1">
            <Button
              variant="pill"
              size="xs"
              className={mode === 'yaml' ? 'active' : ''}
              onClick={() => mode === 'yaml' ? commitYaml() : enterYaml()}
            >
              {mode === 'yaml' ? 'Done' : 'YAML'}
            </Button>
            {mode === 'visual' && (
              <IconButton icon="plus" label="Add property" size="xs" onClick={openAdd} />
            )}
          </div>
        )}
      </div>

      {/* Body */}
      {!collapsed && (
        <div className="border-t border-border px-1 pb-1">
          {mode === 'yaml' ? (
            <div className="p-1">
              <textarea
                value={rawText}
                onChange={e => { setRawText(e.target.value); setRawError('') }}
                rows={Math.max(3, rawText.split('\n').length + 1)}
                className="w-full rounded border border-border bg-surface2 px-2 py-1.5 font-mono text-xs text-text outline-none focus:border-accent/50"
                placeholder="key: value"
                spellCheck={false}
              />
              {rawError && (
                <p className="mt-1 text-[11px] text-red-400">{rawError}</p>
              )}
            </div>
          ) : (
            <>
              {!hasFields && !addOpen && (
                <p className="px-3 py-2 text-xs text-text3">No properties yet</p>
              )}

              {fields.map(field => (
                <FrontmatterFieldRow
                  key={field.key}
                  field={field}
                  onSetValue={setField}
                  onRename={renameField}
                  onRemove={removeField}
                />
              ))}

              {/* Inline add-field form */}
              {addOpen && (
                <div className="mt-1 flex items-center gap-2 rounded-lg bg-surface2 px-2 py-1.5">
                  <input
                    ref={newKeyRef}
                    type="text"
                    value={newKey}
                    onChange={e => setNewKey(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') commitAdd()
                      if (e.key === 'Escape') setAddOpen(false)
                    }}
                    placeholder="Property name"
                    className="min-w-0 flex-1 rounded bg-transparent px-1 text-xs text-text outline-none placeholder:text-text3"
                  />
                  <select
                    value={newType}
                    onChange={e => setNewType(e.target.value as FrontmatterFieldType)}
                    className="rounded bg-surface3 px-1.5 py-0.5 text-xs text-text2 outline-none"
                  >
                    {FIELD_TYPES.map(ft => (
                      <option key={ft.type} value={ft.type}>{ft.label}</option>
                    ))}
                  </select>
                  <Button variant="submit" size="xs" onClick={commitAdd}>
                    Add
                  </Button>
                  <IconButton icon="x" label="Cancel" size="xs" onClick={() => setAddOpen(false)} />
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
