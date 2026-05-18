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

export function parseTags(markdown: string): string[] {
  const tagRegex = /(^|\s)#([a-zA-Z0-9_-]{2,50})/g
  const tags = new Set<string>()
  for (const match of markdown.matchAll(tagRegex)) {
    tags.add(match[2].toLowerCase())
  }
  return Array.from(tags)
}
