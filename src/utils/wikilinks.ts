// Match [[title]] and the markdown-escaped variant \[\[title\]\] that some
// editors (including Milkdown) may emit when serializing double brackets.
// Negative lookbehind ensures we don't match transclusion ![[title]].
const WIKILINK_REGEX = /(?<!!)\\?\[\\?\[([^\]\\]+?)\\?\]\\?\]/g

// Match ![[title]] transclusions
const TRANSCLUSION_REGEX = /!\\?\[\\?\[([^\]\\]+?)\\?\]\\?\]/g

export function parseWikilinks(markdown: string): string[] {
  const links = new Set<string>()
  for (const match of markdown.matchAll(WIKILINK_REGEX)) {
    const value = match[1]?.trim()
    if (value) links.add(value)
  }
  return Array.from(links)
}

export function parseTransclusions(markdown: string): string[] {
  const titles = new Set<string>()
  for (const match of markdown.matchAll(TRANSCLUSION_REGEX)) {
    const value = match[1]?.trim()
    if (value) titles.add(value)
  }
  return Array.from(titles)
}

/**
 * Replace all [[oldTitle]] and ![[oldTitle]] occurrences (including the
 * Milkdown-escaped \[\[…\]\] variant) with the new title.
 * Returns the original string unchanged if no replacements were made.
 */
export function rewriteWikilinksInContent(
  content: string,
  oldTitle: string,
  newTitle: string,
): string {
  if (oldTitle === newTitle || !oldTitle) return content
  // Quick bail-out — avoid the regex entirely if title isn't present
  if (!content.includes(oldTitle)) return content

  // Escape regex-special chars inside the title
  const esc = oldTitle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

  // Matches [[title]], \[\[title\]\], ![[title]], !\[\[title\]\]
  // Group 1 captures the opening brackets (with optional ! and backslashes)
  // Group 2 captures the closing brackets (with optional backslashes)
  const re = new RegExp(`(!?\\\\?\\[\\\\?\\[)${esc}(\\\\?\\]\\\\?\\])`, 'g')

  const result = content.replace(re, `$1${newTitle}$2`)
  return result
}

export function parseTags(markdown: string): string[] {
  const tagRegex = /(^|\s)#([a-zA-Z0-9_-]{2,50})/g
  const tags = new Set<string>()
  for (const match of markdown.matchAll(tagRegex)) {
    tags.add(match[2].toLowerCase())
  }
  return Array.from(tags)
}
