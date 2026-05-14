export function stripMarkdown(content: string): string {
  return content
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/[*_`~\[\]]/g, '')
    .replace(/\[\[([^\]]+)\]\]/g, '$1')
    .replace(/\n+/g, ' ')
    .trim()
}
