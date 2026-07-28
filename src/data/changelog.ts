import rawChangelog from '../../CHANGELOG.md?raw'

export interface ChangelogEntry {
  version: string
  date: string
  highlights: string[]
  added?: string[]
  improved?: string[]
  removed?: string[]
  fixed?: string[]
}

type Bucket = 'added' | 'improved' | 'removed' | 'fixed'

/** Maps a `### <name>` heading to one of the in-app buckets (or null to skip). */
function bucketFor(name: string): Bucket | null {
  const n = name.trim().toLowerCase()
  if (n === 'added') return 'added'
  if (n === 'fixed' || n === 'security') return 'fixed'
  // Removals get their own bucket — filing them under "Improved" reads as though
  // losing a feature were an enhancement.
  if (n === 'removed' || n === 'deprecated') return 'removed'
  if (n === 'changed' || n === 'improved') return 'improved'
  return null
}

/** Strips the markdown that the in-app changelog renders as plain text. */
function stripMd(s: string): string {
  return s
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links → text
    .replace(/`([^`]+)`/g, '$1')             // inline code
    .replace(/\*\*/g, '')                    // bold
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Parses our Keep-a-Changelog CHANGELOG.md into entries. Single source of truth:
 * update the markdown and the in-app "What's new" panel follows automatically.
 *
 *   ## [x.y.z] — date        → new entry
 *   <intro paragraph>        → highlights (before any ### heading)
 *   ### Added|Changed|Fixed  → bucket
 *   - bullet (may wrap)      → item
 */
function parseChangelog(md: string): ChangelogEntry[] {
  const entries: ChangelogEntry[] = []
  let cur: ChangelogEntry | null = null
  let bucket: Bucket | null = null
  let intro: string[] = []
  let bullet: string[] | null = null

  const pushItem = (b: Bucket, text: string) => {
    if (!cur || !text) return
    ;(cur[b] ??= []).push(text)
  }
  const flushBullet = () => {
    if (bullet && cur && bucket) pushItem(bucket, stripMd(bullet.join(' ')))
    bullet = null
  }
  const flushIntro = () => {
    if (cur && intro.length) {
      const text = stripMd(intro.join(' '))
      if (text) cur.highlights.push(text)
    }
    intro = []
  }

  for (const line of md.split(/\r?\n/)) {
    const h2 = line.match(/^##\s+\[([^\]]+)\]\s*(?:[—–-])\s*(.+?)\s*$/)
    if (h2) {
      flushBullet(); flushIntro()
      if (cur) entries.push(cur)
      cur = { version: h2[1], date: h2[2], highlights: [] }
      bucket = null
      continue
    }
    if (!cur) continue // skip the file's title/intro before the first version

    const h3 = line.match(/^###\s+(.+?)\s*$/)
    if (h3) { flushBullet(); flushIntro(); bucket = bucketFor(h3[1]); continue }

    const bulletStart = line.match(/^[-*]\s+(.*)$/)
    if (bulletStart) { flushBullet(); bullet = [bulletStart[1]]; continue }

    if (line.trim() === '') {
      flushBullet()
      if (!bucket) flushIntro()
      continue
    }

    if (bullet) bullet.push(line.trim())          // wrapped bullet continuation
    else if (!bucket) intro.push(line.trim())     // intro paragraph → highlight
  }

  flushBullet(); flushIntro()
  if (cur) entries.push(cur)
  return entries
}

export const CHANGELOG: ChangelogEntry[] = parseChangelog(rawChangelog)
