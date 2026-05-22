#!/usr/bin/env node
/**
 * Converts all direct Lucide JSX usage to <Icon name="token" /> calls.
 * Run from the project root: node scripts/convert-icons.mjs
 */
import { readFileSync, writeFileSync } from 'fs'
import { resolve, relative, dirname } from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SRC = resolve(__dirname, '../src')
const ICON_FILE = `${SRC}/icons/Icon.tsx`

// Lucide PascalCase → icon token
const ICON_MAP = {
  AlertTriangle:  'alert-triangle',
  ArrowLeft:      'arrow-left',
  ArrowRight:     'arrow-right',
  ArrowUpRight:   'arrow-up-right',
  BarChart2:      'bar-chart-2',
  BookOpen:       'book-open',
  Brackets:       'brackets',
  BrainCircuit:   'brain-circuit',
  Bug:            'bug',
  Calendar:       'calendar',
  CalendarDays:   'calendar-days',
  Check:          'check',
  CheckCircle2:   'check-circle-2',
  CheckSquare:    'check-square',
  ChevronDown:    'chevron-down',
  ChevronLeft:    'chevron-left',
  ChevronRight:   'chevron-right',
  ChevronUp:      'chevron-up',
  Circle:         'circle',
  ClipboardCopy:  'clipboard-copy',
  Cloud:          'cloud',
  CloudOff:       'cloud-off',
  Code2:          'code-2',
  Copy:           'copy',
  CornerDownLeft: 'corner-down-left',
  Crosshair:      'crosshair',
  Download:       'download',
  ExternalLink:   'external-link',
  Eye:            'eye',
  FileDown:       'file-down',
  FileJson:       'file-json',
  FileText:       'file-text',
  FlaskConical:   'flask-conical',
  FolderInput:    'folder-input',
  FolderOpen:     'folder-open',
  FolderPlus:     'folder-plus',
  FolderSync:     'folder-sync',
  GitFork:        'git-fork',
  GitMerge:       'git-merge',
  Globe:          'globe',
  GraduationCap:  'graduation-cap',
  GripVertical:   'grip-vertical',
  History:        'history',
  Image:          'image',
  ImageIcon:      'image',      // aliased as `Image as ImageIcon`
  Info:           'info',
  Keyboard:       'keyboard',
  LayoutList:     'layout-list',
  Layers:         'layers',
  Lightbulb:      'lightbulb',
  Link:           'link',
  Link2:          'link-2',
  List:           'list',
  Loader2:        'loader-2',
  MoreHorizontal: 'more-horizontal',
  Network:        'network',
  Palette:        'palette',
  Pencil:         'pencil',
  Pin:            'pin',
  Plus:           'plus',
  Puzzle:         'puzzle',
  Redo2:          'redo-2',
  RefreshCw:      'refresh-cw',
  RotateCcw:      'rotate-ccw',
  Save:           'save',
  ScrollText:     'scroll-text',
  Search:         'search',
  Send:           'send',
  Settings:       'settings',
  Settings2:      'settings-2',
  ShieldCheck:    'shield-check',
  SquareKanban:   'square-kanban',
  StickyNote:     'sticky-note',
  Store:          'store',
  Tag:            'tag',
  Trash2:         'trash-2',
  Undo2:          'undo-2',
  Unlink:         'unlink',
  Users:          'users',
  WifiOff:        'wifi-off',
  X:              'x',
  Zap:            'zap',
}

// Files that use Icon as a component-type prop — handled manually, skip JSX replacement
// but still need to have their imports updated
const SKIP_JSX_CONVERSION = new Set([
  'ActivityBar.tsx',
  'SettingsSidebar.tsx',
  'CommandPalette.tsx',
  'PluginsSection.tsx',
  'Header.tsx',
])

function relativeImport(fromFile, toFile) {
  const rel = relative(dirname(fromFile), toFile).replace(/\.tsx$/, '')
  return rel.startsWith('.') ? rel : './' + rel
}

function processFile(filePath) {
  let src = readFileSync(filePath, 'utf8')
  const fileName = filePath.split('/').pop()

  // Find lucide-react import
  const lucideImportRe = /import\s*\{([^}]+)\}\s*from\s*'lucide-react'/
  const match = src.match(lucideImportRe)
  if (!match) return false

  // Parse imported names (handle `Image as ImageIcon` aliasing)
  const importedNames = new Map() // localName → token
  for (const part of match[1].split(',')) {
    const trimmed = part.trim()
    if (!trimmed) continue
    const asMatch = trimmed.match(/^(\w+)\s+as\s+(\w+)$/)
    if (asMatch) {
      const [, originalName, localAlias] = asMatch
      const token = ICON_MAP[originalName] || ICON_MAP[localAlias]
      if (token) importedNames.set(localAlias, token)
    } else {
      const token = ICON_MAP[trimmed]
      if (token) importedNames.set(trimmed, token)
    }
  }

  if (importedNames.size === 0) return false

  const isSkipped = SKIP_JSX_CONVERSION.has(fileName)
  let modified = src
  const usedForJsx = new Set()

  if (!isSkipped) {
    // Replace JSX usages: <IconName followed by space, newline, /, or >
    for (const [localName, token] of importedNames) {
      // Self-closing and opening tags
      const openRe = new RegExp(`<${localName}(\\s|/|>)`, 'g')
      if (openRe.test(modified)) {
        usedForJsx.add(localName)
        modified = modified.replace(
          new RegExp(`<${localName}(\\s|/|>)`, 'g'),
          `<Icon name="${token}"$1`,
        )
        // Closing tags (rare but handle it)
        modified = modified.replace(
          new RegExp(`</${localName}>`, 'g'),
          `</Icon>`,
        )
      }
    }
  }

  // If no JSX was replaced and this file isn't skipped, nothing to do
  if (usedForJsx.size === 0 && !isSkipped) return false

  // Build new import(s):
  // 1. Remove converted icons from the lucide import
  // 2. Add Icon import if any JSX was converted
  const iconImportPath = relativeImport(filePath, ICON_FILE)

  // Reconstruct lucide import without the converted icon names
  const remainingLucide = match[1]
    .split(',')
    .map(p => p.trim())
    .filter(p => {
      if (!p) return false
      const asMatch = p.match(/^(\w+)\s+as\s+(\w+)$/)
      const localName = asMatch ? asMatch[2] : p
      return !usedForJsx.has(localName)
    })

  if (remainingLucide.length === 0) {
    // Remove the entire lucide import
    modified = modified.replace(lucideImportRe, '')
    // Clean up blank line left behind
    modified = modified.replace(/\n\n\n/g, '\n\n')
  } else {
    // Keep remaining icons in the lucide import
    const newLucideImport = `import { ${remainingLucide.join(', ')} } from 'lucide-react'`
    modified = modified.replace(lucideImportRe, newLucideImport)
  }

  // Add Icon import if JSX was converted (avoid duplicates)
  if (usedForJsx.size > 0 && !modified.includes("from '") || !modified.includes('/icons/Icon')) {
    if (!modified.includes(`from '${iconImportPath}'`) && !modified.includes("from '../icons/Icon'") && !modified.includes("from '../../icons/Icon'") && !modified.includes("from '../../../icons/Icon'")) {
      // Insert after the last import line
      const lastImportIdx = [...modified.matchAll(/^import .+/gm)].pop()
      if (lastImportIdx) {
        const insertAt = lastImportIdx.index + lastImportIdx[0].length
        modified = modified.slice(0, insertAt) + `\nimport { Icon } from '${iconImportPath}'` + modified.slice(insertAt)
      }
    }
  }

  if (modified !== src) {
    writeFileSync(filePath, modified, 'utf8')
    return true
  }
  return false
}

// Find all tsx files with lucide-react imports
const files = execSync(
  `grep -rl "from 'lucide-react'" ${SRC} --include="*.tsx" --include="*.ts"`,
  { encoding: 'utf8' }
).trim().split('\n').filter(Boolean)

let converted = 0
for (const file of files) {
  const changed = processFile(file)
  if (changed) {
    console.log(`✓ ${relative(SRC, file)}`)
    converted++
  }
}
console.log(`\nConverted ${converted} / ${files.length} files.`)
