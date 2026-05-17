import { useEffect, useRef, useState } from 'react'
import { Plus, X } from 'lucide-react'
import { Button } from '../atoms/Button'
import type { TagRecord } from '../../types'

interface TagSelectorProps {
  selectedTags: string[]
  onTagsChange: (tags: string[]) => void
  availableTags?: TagRecord[]
}

export function TagSelector({ selectedTags, onTagsChange, availableTags = [] }: TagSelectorProps): JSX.Element {
  const [isOpen, setIsOpen] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)

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
    }
    setNewTagName('')
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

      {isOpen && (
        <div className="absolute top-full left-0 z-50 mt-2 w-64 rounded-lg border border-border bg-surface2 shadow-lg">
          {availableTags.length > 0 && (
            <div className="border-b border-border p-3">
              <p className="mb-2 text-xs font-semibold text-text3">Existing tags</p>
              <div className="flex flex-wrap gap-1">
                {availableTags.map((tag) => (
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

          <form onSubmit={handleAddTag} className="p-3">
            <p className="mb-2 text-xs font-semibold text-text3">Add new tag</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={newTagName}
                onChange={(e) => setNewTagName(e.target.value)}
                placeholder="tag-name…"
                className="flex-1 rounded-md border border-border bg-surface px-2 py-1.5 text-xs text-text outline-none focus:border-accent placeholder:text-text3"
                autoFocus
              />
              <Button type="submit" variant="primary" size="xs" disabled={!newTagName.trim()}>
                Add
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
