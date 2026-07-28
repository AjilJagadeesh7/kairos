import { useState } from 'react'
import { Icon } from '../../icons/Icon'
import { Divider } from '../atoms/Divider'

// ── Primitives ────────────────────────────────────────────────────────────────

type ItemProps = {
  label: string
  shortcut?: string
  onClick: () => void
  danger?: boolean
  disabled?: boolean
}

function Item({ label, shortcut, onClick, danger, disabled }: ItemProps) {
  return (
    <button
      className={`flex w-full items-center justify-between rounded px-3 py-[5px] text-left text-[13px] transition-colors
        ${disabled ? 'pointer-events-none opacity-35' : 'hover:bg-surface3'}
        ${danger ? 'text-red-400' : 'text-text'}`}
      onMouseDown={(e) => e.preventDefault()}
      onClick={disabled ? undefined : onClick}
    >
      <span>{label}</span>
      {shortcut && <span className="ml-8 shrink-0 text-[11px] text-text3">{shortcut}</span>}
    </button>
  )
}

function Sep() {
  return <Divider className="my-1" />
}

function Sub({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        className={`flex w-full items-center justify-between rounded px-3 py-[5px] text-left text-[13px] text-text transition-colors hover:bg-surface3 ${open ? 'bg-surface3' : ''}`}
        onMouseDown={(e) => e.preventDefault()}
      >
        <span>{label}</span>
        <Icon name="chevron-right" size={13} className="ml-4 shrink-0 text-text3" />
      </button>
      {open && (
        <div className="absolute left-full top-0 z-50 min-w-[190px] rounded-md border border-border bg-surface p-1 shadow-soft">
          {children}
        </div>
      )}
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

type ContextMenuProps = {
  x: number
  y: number
  kind: 'table' | 'image' | 'text' | 'default'
  rowIndex: number
  colIndex: number
  selectedText: string
  // table
  onAddColBefore: () => void
  onAddColAfter: () => void
  onRemoveCol: () => void
  onAddRowBefore: () => void
  onAddRowAfter: () => void
  onRemoveRow: () => void
  // image
  onResizeImage: (width: number | null) => void
  // format
  onBold: () => void
  onItalic: () => void
  onInlineCode: () => void
  onStrikethrough: () => void
  onClearFormatting: () => void
  // paragraph / turn-into
  onBulletList: () => void
  onOrderedList: () => void
  onTaskList: () => void
  onBlockquote: () => void
  onHeading: (level: 1 | 2 | 3 | 4 | 5 | 6) => void
  onTurnIntoText: () => void
  // insert
  onInsertTable: () => void
  onInsertCallout: () => void
  onInsertHr: () => void
  onInsertCodeBlock: () => void
  onInsertChart: () => void
  // links
  onAddLink: () => void
  onAddTransclusion: () => void
  onAddExternalLink: () => void
  // clipboard
  onCut: () => void
  onCopy: () => void
  onPaste: () => void
  onSelectAll: () => void
}

export function ContextMenu({
  x, y, kind, selectedText,
  onAddColBefore, onAddColAfter, onRemoveCol,
  onAddRowBefore, onAddRowAfter, onRemoveRow,
  onResizeImage,
  onBold, onItalic, onInlineCode, onStrikethrough, onClearFormatting,
  onBulletList, onOrderedList, onTaskList, onBlockquote,
  onHeading, onTurnIntoText,
  onInsertTable, onInsertCallout, onInsertHr, onInsertCodeBlock, onInsertChart,
  onAddLink, onAddTransclusion, onAddExternalLink,
  onCut, onCopy, onPaste, onSelectAll,
}: ContextMenuProps): JSX.Element {
  const ax = Math.min(x, window.innerWidth  - 224)
  const ay = Math.min(y, window.innerHeight - 420)

  const hasSelection = kind === 'text' && selectedText.length > 0
  const preview = selectedText.length > 24 ? selectedText.slice(0, 24) + '…' : selectedText

  return (
    <div
      className="fixed z-50 min-w-[210px] rounded-md border border-border bg-surface p-1 shadow-soft"
      style={{ left: ax, top: ay }}
      role="menu"
      onClick={(e) => e.stopPropagation()}
    >
      {/* ── Selected text: search shortcut ──────────────────────── */}
      {hasSelection && (
        <>
          <Item label={`Search for "${preview}"`} onClick={() =>
            window.dispatchEvent(new CustomEvent('mv:search', { detail: { query: selectedText } }))
          } />
          <Sep />
        </>
      )}

      {/* ── Insert links / embeds ───────────────────────────────── */}
      {kind !== 'image' && (
        <>
          <Sub label="Link / embed">
            <Item label="Wikilink"              onClick={onAddLink} />
            <Item label="Embed (transclusion)"  onClick={onAddTransclusion} />
            <Item label="External link"         onClick={onAddExternalLink} />
          </Sub>
          <Sep />
        </>
      )}

      {/* ── Table controls ──────────────────────────────────────── */}
      {kind === 'table' && (
        <>
          <Item label="Add column before" onClick={onAddColBefore} />
          <Item label="Add column after"  onClick={onAddColAfter} />
          <Item label="Remove column"     onClick={onRemoveCol} danger />
          <Sep />
          <Item label="Add row before"    onClick={onAddRowBefore} />
          <Item label="Add row after"     onClick={onAddRowAfter} />
          <Item label="Remove row"        onClick={onRemoveRow} danger />
          <Sep />
        </>
      )}

      {/* ── Image controls ──────────────────────────────────────── */}
      {kind === 'image' && (
        <>
          <Sub label="Resize image">
            <Item label="Small  (240 px)" onClick={() => onResizeImage(240)} />
            <Item label="Medium (480 px)" onClick={() => onResizeImage(480)} />
            <Item label="Large  (720 px)" onClick={() => onResizeImage(720)} />
            <Item label="Full width"      onClick={() => onResizeImage(null)} />
          </Sub>
          <Sep />
        </>
      )}

      {/* ── Format / Paragraph / Insert ─────────────────────────── */}
      {kind !== 'image' && (
        <>
          <Sub label="Format">
            <Item label="Bold"            shortcut="Ctrl+B"  onClick={onBold} />
            <Item label="Italic"          shortcut="Ctrl+I"  onClick={onItalic} />
            <Item label="Strikethrough"                      onClick={onStrikethrough} />
            <Item label="Code"            shortcut="Ctrl+`"  onClick={onInlineCode} />
            <Sep />
            <Item label="Clear formatting"                   onClick={onClearFormatting} />
          </Sub>
          <Sub label="Paragraph">
            <Item label="Bullet list"    onClick={onBulletList} />
            <Item label="Numbered list"  onClick={onOrderedList} />
            <Item label="Task list"      onClick={onTaskList} />
            <Sep />
            <Item label="Heading 1"      onClick={() => onHeading(1)} />
            <Item label="Heading 2"      onClick={() => onHeading(2)} />
            <Item label="Heading 3"      onClick={() => onHeading(3)} />
            <Item label="Heading 4"      onClick={() => onHeading(4)} />
            <Item label="Heading 5"      onClick={() => onHeading(5)} />
            <Item label="Heading 6"      onClick={() => onHeading(6)} />
            <Sep />
            <Item label="Body"           onClick={onTurnIntoText} />
            <Item label="Quote"          onClick={onBlockquote} />
          </Sub>
          <Sub label="Insert">
            <Item label="Table"          onClick={onInsertTable} />
            <Item label="Callout"        onClick={onInsertCallout} />
            <Item label="Chart"          onClick={onInsertChart} />
            <Item label="Horizontal rule" onClick={onInsertHr} />
            <Item label="Code block"     onClick={onInsertCodeBlock} />
          </Sub>
          <Sep />
        </>
      )}

      {/* ── Clipboard ───────────────────────────────────────────── */}
      {hasSelection              && <Item label="Cut"               shortcut="Ctrl+X"       onClick={onCut} />}
      {(hasSelection || kind === 'image') && <Item label="Copy"    shortcut="Ctrl+C"        onClick={onCopy} />}
      <Item label="Paste"                   shortcut="Ctrl+V"                               onClick={onPaste} />
      {hasSelection              && <Item label="Paste as plain text" shortcut="Ctrl+Shift+V" onClick={onPaste} />}
      {kind !== 'image'          && <Item label="Select all"       shortcut="Ctrl+A"        onClick={onSelectAll} />}
    </div>
  )
}
