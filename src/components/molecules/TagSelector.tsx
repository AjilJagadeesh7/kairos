import { useEffect, useRef, useState } from 'react'

import { Button } from '../atoms/Button'
import { ColorPicker } from './ColorPicker'
import { SectionLabel } from '../atoms/SectionLabel'
import { TAG_COLOR_PALETTE, tagTextColor, tagColorFromName as autoColor } from '../../utils/kanban'
import type { TagRecord } from '../../types'
import { Icon } from '../../icons/Icon'

interface TagSelectorProps {
  selectedTags: string[]
  onTagsChange: (tags: string[]) => void
  onTagCreate?: (name: string, color: string) => void
  availableTags?: TagRecord[]
}

export function TagSelector({ selectedTags, onTagsChange, onTagCreate, availableTags = [] }: TagSelectorProps): JSX.Element {
  const [isOpen,      setIsOpen]      = useState(false)
  const [newTagName,  setNewTagName]  = useState('')
  const [newTagColor, setNewTagColor] = useState(TAG_COLOR_PALETTE[0])
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Auto-update preview color as user types
  useEffect(() => {
    if (newTagName.trim()) setNewTagColor(autoColor(newTagName.trim()))
  }, [newTagName])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleAddTag = (e: React.FormEvent) => {
    e.preventDefault()
    const tagName = newTagName.trim().toLowerCase()
    if (!tagName) return
    if (!selectedTags.includes(tagName)) {
      onTagsChange([...selectedTags, tagName])
      onTagCreate?.(tagName, newTagColor)
    }
    setNewTagName('')
    setNewTagColor(TAG_COLOR_PALETTE[0])
    setIsOpen(false)
  }

  const handleSelectTag = (tagName: string) => {
    if (selectedTags.includes(tagName)) {
      onTagsChange(selectedTags.filter(t => t !== tagName))
    } else {
      onTagsChange([...selectedTags, tagName])
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        variant="pill"
        size="xs"
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-1"
      >
        <Icon name="plus" size={13} /> Tag
      </Button>

      {isOpen && (
        <div className="absolute left-0 top-full z-50 mt-2 w-72 rounded-lg border border-border bg-surface2 shadow-lg">
          {availableTags.length > 0 && (
            <div className="border-b border-border p-3">
              <p className="mb-2 text-xs font-semibold text-text3">Existing tags</p>
              <div className="flex flex-wrap gap-1">
                {availableTags.map(tag => (
                  <button
                    key={tag.name}
                    type="button"
                    onClick={() => handleSelectTag(tag.name)}
                    className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium transition ${
                      selectedTags.includes(tag.name) ? 'ring-2 ring-offset-2 ring-offset-surface2' : 'opacity-80 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: tag.color, color: tagTextColor(tag.color) }}
                  >
                    #{tag.name}
                    {selectedTags.includes(tag.name) && <Icon name="x" size={10} />}
                  </button>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={handleAddTag} className="p-3">
            <p className="mb-2 text-xs font-semibold text-text3">New tag</p>

            {/* Name input with color swatch preview */}
            <div className="mb-3 flex gap-2">
              <div
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
                style={{ backgroundColor: newTagColor }}
              />
              <input
                type="text"
                value={newTagName}
                onChange={e => setNewTagName(e.target.value)}
                placeholder="tag-name…"
                className="flex-1 rounded-md border border-border bg-surface px-2 py-1.5 text-xs text-text outline-none focus:border-accent placeholder:text-text3"
                autoFocus
              />
            </div>

            {/* Color swatches */}
            <SectionLabel className="mb-1.5">Color</SectionLabel>
            <ColorPicker
              value={newTagColor}
              onChange={setNewTagColor}
              cols={6}
              className="mb-3"
            />

            <Button type="submit" variant="primary" size="xs" disabled={!newTagName.trim()} className="w-full justify-center">
              Add tag
            </Button>
          </form>
        </div>
      )}
    </div>
  )
}
