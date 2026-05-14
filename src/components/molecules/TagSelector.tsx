import { useEffect, useRef, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { useLiveQuery } from 'dexie-react-hooks'
import { getAllTags, upsertTag } from '../../db/schema'
import { Button } from '../atoms/Button'
import type { TagRecord } from '../../types'

const PRESET_COLORS = [
  '#ef4444', // red
  '#f97316', // orange
  '#eab308', // yellow
  '#22c55e', // green
  '#0ea5e9', // blue
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#6366f1', // indigo
  '#14b8a6', // teal
  '#a855f7', // violet
]

interface TagSelectorProps {
  selectedTags: string[]
  onTagsChange: (tags: string[]) => void
}

export function TagSelector({ selectedTags, onTagsChange }: TagSelectorProps): JSX.Element {
  const allTags = useLiveQuery(() => getAllTags())
  const tags = allTags ?? []
  const [isOpen, setIsOpen] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0])
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleAddTag = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newTagName.trim()) return

    const tagName = newTagName.trim().toLowerCase()
    const existingTag = tags.find((t) => t.name === tagName)

    if (!existingTag) {
      const newTag: TagRecord = {
        name: tagName,
        color: selectedColor,
        createdAt: new Date().toISOString(),
      }
      await upsertTag(newTag)
    }

    // Add to selected tags if not already there
    if (!selectedTags.includes(tagName)) {
      onTagsChange([...selectedTags, tagName])
    }

    setNewTagName('')
    setSelectedColor(PRESET_COLORS[0])
    setIsOpen(false)
  }

  const handleSelectTag = (tagName: string) => {
    if (selectedTags.includes(tagName)) {
      onTagsChange(selectedTags.filter((t) => t !== tagName))
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
        <Plus size={13} /> Tag
      </Button>

      {/* Dropdown menu */}
      {isOpen && (
        <div className="absolute top-full left-0 z-50 mt-2 w-64 rounded-lg border border-border bg-surface2 shadow-lg">
          {/* Existing tags */}
          {tags.length > 0 && (
            <div className="border-b border-border p-3">
              <p className="mb-2 text-xs font-semibold text-text3">Existing tags</p>
              <div className="flex flex-wrap gap-1">
                {tags.map((tag) => (
                  <button
                    key={tag.name}
                    type="button"
                    onClick={() => handleSelectTag(tag.name)}
                    className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium text-white transition ${
                      selectedTags.includes(tag.name) ? 'ring-2 ring-offset-2 ring-offset-surface2' : 'opacity-80 hover:opacity-100'
                    }`}
                    style={{ backgroundColor: tag.color }}
                  >
                    #{tag.name}
                    {selectedTags.includes(tag.name) && <X size={10} />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* New tag form */}
          <form onSubmit={handleAddTag} className="p-3">
            <p className="mb-2 text-xs font-semibold text-text3">Create new tag</p>
            <div className="mb-2 flex gap-2">
              <input
                type="text"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="Tag name…"
                className="flex-1 rounded-md border border-border bg-surface px-2 py-1.5 text-xs text-text outline-none focus:border-accent placeholder:text-text3"
                autoFocus
              />
            </div>

            {/* Color picker */}
            <p className="mb-2 text-[10px] font-semibold text-text3">Color</p>
            <div className="mb-3 flex flex-wrap gap-2">
              {PRESET_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setSelectedColor(color)}
                  className={`h-6 w-6 rounded-full transition ${
                    selectedColor === color ? 'ring-2 ring-offset-2 ring-offset-surface2' : 'hover:opacity-80'
                  }`}
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>

            <Button
              type="submit"
              variant="primary"
              size="xs"
              className="w-full"
              disabled={!newTagName.trim()}
            >
              Create & Add Tag
            </Button>
          </form>
        </div>
      )}
    </div>
  )
}
