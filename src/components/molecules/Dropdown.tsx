import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { ReactNode } from 'react'
import { Icon } from '../../icons/Icon'

const GAP  = 4   // space between the trigger and the menu
const EDGE = 8   // keep the menu this far off the viewport edges

interface DropdownProps {
  children: ReactNode
  trigger?: ReactNode
  className?: string
  onOpenChange?: (open: boolean) => void
  /**
   * Render the menu into a portal, positioned fixed against the trigger.
   * Needed inside anything that clips overflow — the sidebar container uses
   * `overflow-hidden` for its resize animation, which otherwise cuts an
   * absolutely-positioned menu off at the sidebar's edge (z-index can't help,
   * clipping ignores it).
   */
  portal?: boolean
}

export function Dropdown({ children, trigger, className = '', onOpenChange, portal = false }: DropdownProps): JSX.Element {
  const [isOpen, setIsOpen] = useState(false)
  const [alignRight, setAlignRight] = useState(false)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const close = useCallback(() => {
    setIsOpen(false)
    onOpenChange?.(false)
  }, [onOpenChange])

  // Flip the menu to right-align if it would overflow the viewport's right edge.
  useLayoutEffect(() => {
    if (!isOpen || portal) { setAlignRight(false); return }
    const el = menuRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    if (rect.right > window.innerWidth - EDGE) setAlignRight(true)
  }, [isOpen, portal])

  // Portal mode: measure trigger and menu, then place it — flipping above the
  // trigger or right-aligning when there isn't room below or to the right.
  useLayoutEffect(() => {
    // No need to clear on close: this runs before paint on every open, so a
    // stale position from last time is overwritten without ever being shown.
    if (!isOpen || !portal) return
    const anchor = dropdownRef.current
    const menu   = menuRef.current
    if (!anchor || !menu) return

    const t = anchor.getBoundingClientRect()
    const m = menu.getBoundingClientRect()

    let left = t.left
    if (left + m.width > window.innerWidth - EDGE) left = Math.max(EDGE, t.right - m.width)

    let top = t.bottom + GAP
    if (top + m.height > window.innerHeight - EDGE) top = Math.max(EDGE, t.top - m.height - GAP)

    setPos({ top, left })
  }, [isOpen, portal])

  useEffect(() => {
    if (!isOpen) return

    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node
      // A portalled menu sits outside dropdownRef, so it needs its own check —
      // without it every click on a menu item would count as "outside".
      const inside = dropdownRef.current?.contains(target) || menuRef.current?.contains(target)
      if (!inside) close()
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, close])

  // A fixed menu can't follow its trigger — close instead of letting it detach.
  useEffect(() => {
    if (!isOpen || !portal) return
    const onReflow = () => close()
    window.addEventListener('scroll', onReflow, true)
    window.addEventListener('resize', onReflow)
    return () => {
      window.removeEventListener('scroll', onReflow, true)
      window.removeEventListener('resize', onReflow)
    }
  }, [isOpen, portal, close])

  const handleToggle = () => {
    const newState = !isOpen
    setIsOpen(newState)
    onOpenChange?.(newState)
  }

  // Resolve trigger and content based on usage pattern
  let resolvedTrigger: ReactNode
  let resolvedContent: ReactNode

  if (trigger !== undefined) {
    // New pattern: <Dropdown trigger={<button>}>{content}</Dropdown>
    resolvedTrigger = trigger
    resolvedContent = children
  } else {
    // Legacy pattern: <Dropdown>{trigger}{content}</Dropdown>
    const childArray = Array.isArray(children) ? children : [children]
    resolvedTrigger = childArray[0]
    resolvedContent = childArray[1]
  }

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      {trigger !== undefined ? (
        // Custom trigger: wrap in a div with click handler
        <div onClick={handleToggle} className="cursor-pointer">
          {resolvedTrigger}
        </div>
      ) : (
        // Legacy styled button trigger with chevron
        <button
          type="button"
          onClick={handleToggle}
          className="flex w-full items-center justify-between rounded-md border border-border bg-surface px-2 py-2 text-xs text-text outline-none hover:bg-surface2 focus:border-accent"
        >
          {resolvedTrigger}
          <Icon name="chevron-down" size={12} className={`text-text3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        </button>
      )}

      {isOpen && !portal && (
        <div
          ref={menuRef}
          className={`absolute top-full z-50 mt-1 max-w-[calc(100vw-1rem)] rounded-md border border-border bg-surface p-1 shadow-lg ${
            alignRight ? 'right-0' : 'left-0'
          }`}
        >
          {resolvedContent}
        </div>
      )}

      {isOpen && portal && createPortal(
        <div
          ref={menuRef}
          style={{
            top:  pos?.top  ?? 0,
            left: pos?.left ?? 0,
            // Rendered once unpositioned so it can be measured; hidden until then
            // so it never flashes in the wrong place.
            visibility: pos ? 'visible' : 'hidden',
          }}
          className="fixed z-[60] max-w-[calc(100vw-1rem)] rounded-md border border-border bg-surface p-1 shadow-lg"
        >
          {resolvedContent}
        </div>,
        document.body,
      )}
    </div>
  )
}
