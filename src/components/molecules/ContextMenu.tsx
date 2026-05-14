import { MenuItem } from './MenuItem'

type ContextMenuProps = {
  x: number
  y: number
  kind: 'table' | 'image' | 'text' | 'default'
  rowIndex: number
  colIndex: number
  onAddColBefore: () => void
  onAddColAfter: () => void
  onRemoveCol: () => void
  onAddRowBefore: () => void
  onAddRowAfter: () => void
  onRemoveRow: () => void
  onResizeImage: (width: number | null) => void
  onBold: () => void
  onItalic: () => void
  onInlineCode: () => void
  onStrikethrough: () => void
  onInsertTable: () => void
  onHeading: (level: 1 | 2 | 3) => void
  onTurnIntoText: () => void
}

export function ContextMenu({
  x,
  y,
  kind,
  onAddColBefore,
  onAddColAfter,
  onRemoveCol,
  onAddRowBefore,
  onAddRowAfter,
  onRemoveRow,
  onResizeImage,
  onBold,
  onItalic,
  onInlineCode,
  onStrikethrough,
  onInsertTable,
  onHeading,
  onTurnIntoText,
}: ContextMenuProps): JSX.Element {
  return (
    <div
      className="fixed z-50 min-w-[180px] rounded-md border border-border bg-surface p-1 shadow-soft"
      style={{ left: `${x}px`, top: `${y}px` }}
      role="menu"
      onClick={(e) => e.stopPropagation()}
    >
      {kind === 'table' && (
        <>
          <MenuItem label="Add column before" onClick={onAddColBefore} />
          <MenuItem label="Add column after"  onClick={onAddColAfter} />
          <MenuItem label="Remove column"     onClick={onRemoveCol} danger />
          <div className="my-1 border-t border-border" />
          <MenuItem label="Add row before"    onClick={onAddRowBefore} />
          <MenuItem label="Add row after"     onClick={onAddRowAfter} />
          <MenuItem label="Remove row"        onClick={onRemoveRow} danger />
        </>
      )}

      {kind === 'image' && (
        <>
          <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-text3">Resize image</p>
          <MenuItem label="Small  (240px)" onClick={() => onResizeImage(240)} />
          <MenuItem label="Medium (480px)" onClick={() => onResizeImage(480)} />
          <MenuItem label="Large  (720px)" onClick={() => onResizeImage(720)} />
          <MenuItem label="Full width"     onClick={() => onResizeImage(null)} />
        </>
      )}

      {kind === 'text' && (
        <>
          <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-text3">Format</p>
          <MenuItem label="Bold"          onClick={onBold} />
          <MenuItem label="Italic"        onClick={onItalic} />
          <MenuItem label="Inline code"   onClick={onInlineCode} />
          <MenuItem label="Strikethrough" onClick={onStrikethrough} />
          <div className="my-1 border-t border-border" />
          <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-text3">Turn into</p>
          <MenuItem label="Heading 1" onClick={() => onHeading(1)} />
          <MenuItem label="Heading 2" onClick={() => onHeading(2)} />
          <MenuItem label="Heading 3" onClick={() => onHeading(3)} />
          <MenuItem label="Normal text" onClick={onTurnIntoText} />
          <div className="my-1 border-t border-border" />
          <MenuItem label="Insert table"  onClick={onInsertTable} />
        </>
      )}

      {kind === 'default' && (
        <>
          <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-text3">Turn into</p>
          <MenuItem label="Heading 1" onClick={() => onHeading(1)} />
          <MenuItem label="Heading 2" onClick={() => onHeading(2)} />
          <MenuItem label="Heading 3" onClick={() => onHeading(3)} />
          <MenuItem label="Normal text" onClick={onTurnIntoText} />
          <div className="my-1 border-t border-border" />
          <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-text3">Insert</p>
          <MenuItem label="Table 3×3"  onClick={onInsertTable} />
        </>
      )}
    </div>
  )
}
