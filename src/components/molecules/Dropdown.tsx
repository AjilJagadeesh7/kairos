import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'

interface DropdownProps {
  children: [ReactNode, ReactNode] // [trigger, content]
  className?: string
  onOpenChange?: (open: boolean) => void
}

export function Dropdown({ children, className = '', onOpenChange }: DropdownProps): JSX.Element {
  const [trigger, content] = children
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
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

  return (
    <div className={`relative ${className}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={handleToggle}
        className="flex w-full items-center justify-between rounded-md border border-border bg-surface px-2 py-2 text-xs text-text outline-none hover:bg-surface2 focus:border-accent"
      >
        {trigger}
        <ChevronDown size={12} className={`text-text3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-md border border-border bg-surface p-3 shadow-lg">
          {content}
        </div>
      )}
    </div>
  )
}
