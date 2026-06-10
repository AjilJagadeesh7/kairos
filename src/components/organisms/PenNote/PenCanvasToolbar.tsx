import { IconButton } from '../../atoms/IconButton'
import { ToggleSwitch } from '../../atoms/ToggleSwitch'
import { Icon } from '../../../icons/Icon'
import { PEN_COLORS, HIGHLIGHTER_COLORS, PEN_SIZES, AUTO_INK } from '../../../types'
import type { PenTool } from '../../../types'
import type { PenCanvasEngine } from './usePenCanvasEngine'
import type { IconToken } from '../../../icons/tokens'

const TOOLS: { tool: PenTool; icon: IconToken; label: string }[] = [
  { tool: 'pen', icon: 'pencil', label: 'Pen' },
  { tool: 'highlighter', icon: 'highlighter', label: 'Highlighter' },
  { tool: 'eraser', icon: 'eraser', label: 'Eraser' },
  { tool: 'lasso', icon: 'lasso', label: 'Lasso select' },
]

interface Props {
  engine: PenCanvasEngine
  onSelectionToText?: () => void
  toTextAvailable?: boolean
}

export function PenCanvasToolbar({ engine, onSelectionToText, toTextAvailable }: Props): JSX.Element {
  const { tool, setTool, color, setColor, size, setSize, allowFinger, setAllowFinger,
    canUndo, canRedo, undo, redo, hasSelection, deleteSelection } = engine
  const showColors = tool === 'pen' || tool === 'highlighter'
  const palette = tool === 'highlighter' ? HIGHLIGHTER_COLORS : PEN_COLORS

  return (
    <div className="flex flex-wrap items-center gap-1.5 border-b border-border bg-bg px-3 py-1.5">
      {/* Tools */}
      <div className="flex items-center rounded-md bg-surface2 p-0.5">
        {TOOLS.map(t => (
          <button
            key={t.tool}
            type="button"
            aria-label={t.label}
            aria-pressed={tool === t.tool}
            title={t.label}
            onClick={() => setTool(t.tool)}
            className={`flex h-7 w-8 items-center justify-center rounded transition ${tool === t.tool ? 'bg-bg text-accent shadow-sm' : 'text-text3 hover:text-text'}`}
          >
            <Icon name={t.icon} size={16} />
          </button>
        ))}
      </div>

      {showColors && (
        <>
          <span className="h-4 w-px bg-border" />
          <div className="flex items-center gap-0.5">
            {palette.map(c => (
              <button
                key={c}
                type="button"
                aria-label={c === AUTO_INK ? 'Default ink (theme color)' : `Color ${c}`}
                title={c === AUTO_INK ? 'Default (follows theme)' : undefined}
                onClick={() => setColor(c)}
                className={`flex h-5 w-5 items-center justify-center rounded-full border transition ${color === c ? 'border-text ring-1 ring-text' : 'border-border'} ${c === AUTO_INK ? 'bg-text text-bg' : ''}`}
                style={c === AUTO_INK ? undefined : { backgroundColor: c }}
              >
                {c === AUTO_INK && <span className="text-[9px] font-bold leading-none">A</span>}
              </button>
            ))}
          </div>
        </>
      )}

      {tool === 'pen' && (
        <>
          <span className="h-4 w-px bg-border" />
          <div className="flex items-center gap-0.5">
            {PEN_SIZES.map(s => (
              <button
                key={s}
                type="button"
                aria-label={`Size ${s}`}
                onClick={() => setSize(s)}
                className={`flex h-7 w-7 items-center justify-center rounded-md transition hover:bg-surface3 ${size === s ? 'bg-surface3' : ''}`}
              >
                <span className="rounded-full bg-text" style={{ width: s + 2, height: s + 2 }} />
              </button>
            ))}
          </div>
        </>
      )}

      <span className="h-4 w-px bg-border" />
      <IconButton icon="undo-2" label="Undo" size="sm" disabled={!canUndo} onClick={undo} />
      <IconButton icon="redo-2" label="Redo" size="sm" disabled={!canRedo} onClick={redo} />

      {hasSelection && (
        <>
          <span className="h-4 w-px bg-border" />
          <IconButton icon="trash-2" label="Delete selection" size="sm" onClick={deleteSelection} className="hover:bg-red-500/10 hover:text-red-400" />
          {toTextAvailable && onSelectionToText && (
            <button
              type="button"
              onClick={onSelectionToText}
              className="flex h-7 items-center gap-1 rounded-md bg-accent/10 px-2 text-xs font-medium text-accent transition hover:bg-accent/20"
            >
              <Icon name="type" size={13} /> To text
            </button>
          )}
        </>
      )}

      <div className="flex-1" />

      {/* Finger-draw toggle (off = stylus draws, finger scrolls) */}
      <label className="flex items-center gap-1.5 text-[11px] text-text3">
        <Icon name="hand" size={13} />
        <span className="hidden sm:inline">Finger draws</span>
        <ToggleSwitch checked={allowFinger} onChange={setAllowFinger} size="sm" label="Finger draws" />
      </label>
    </div>
  )
}
