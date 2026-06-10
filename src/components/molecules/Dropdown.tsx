import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Icon } from '../../icons/Icon'

interface DropdownProps {
  children: ReactNode
  trigger?: ReactNode
  className?: string
  onOpenChange?: (open: boolean) => void
}

export function Dropdown({ children, trigger, className = '', onOpenChange }: DropdownProps): JSX.Element {
  const [isOpen, setIsOpen] = useState(false)
  const [alignRight, setAlignRight] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Flip the menu to right-align if it would overflow the viewport's right edge.
  useLayoutEffect(() => {
    if (!isOpen) { setAlignRight(false); return }
    const el = menuRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    if (rect.right > window.innerWidth - 8) setAlignRight(true)
  }, [isOpen])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        onOpenChange?.(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onOpenChange])

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

      {isOpen && (
        <div
          ref={menuRef}
          className={`absolute top-full z-50 mt-1 max-w-[calc(100vw-1rem)] rounded-md border border-border bg-surface p-1 shadow-lg ${
            alignRight ? 'right-0' : 'left-0'
          }`}
        >
          {resolvedContent}
        </div>
      )}
    </div>
  )
}
