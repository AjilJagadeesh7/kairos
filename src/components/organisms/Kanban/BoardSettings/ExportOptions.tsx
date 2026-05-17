import { Download, FileJson, FileText } from 'lucide-react'
import { exportBoardToJSON, exportBoardToMarkdown } from '../../../../utils/kanban'
import type { Board } from '../../../../types/kanban.types'

interface ExportOptionsProps {
  board: Board
}

function downloadFile(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function ExportOptions({ board }: ExportOptionsProps): JSX.Element {
  const slug = board.title.toLowerCase().replace(/\s+/g, '-')

  function handleExportJSON() {
    downloadFile(exportBoardToJSON(board), `${slug}.json`, 'application/json')
  }

  function handleExportMarkdown() {
    downloadFile(exportBoardToMarkdown(board), `${slug}.md`, 'text/markdown')
  }

  return (
    <div className="flex flex-col gap-3">
      <button
        onClick={handleExportJSON}
        className="flex items-center gap-3 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] p-3 text-left transition hover:border-[rgb(var(--accent))]"
      >
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-[rgb(var(--surface-3))]">
          <FileJson size={18} className="text-[rgb(var(--accent))]" />
        </div>
        <div>
          <p className="text-sm font-medium text-[rgb(var(--text))]">Export as JSON</p>
          <p className="text-xs text-[rgb(var(--text-3))]">Full board data — importable back into MindVault</p>
        </div>
        <Download size={14} className="ml-auto text-[rgb(var(--text-3))]" />
      </button>

      <button
        onClick={handleExportMarkdown}
        className="flex items-center gap-3 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface-2))] p-3 text-left transition hover:border-[rgb(var(--accent))]"
      >
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-[rgb(var(--surface-3))]">
          <FileText size={18} className="text-[rgb(var(--accent))]" />
        </div>
        <div>
          <p className="text-sm font-medium text-[rgb(var(--text))]">Export as Markdown</p>
          <p className="text-xs text-[rgb(var(--text-3))]">Obsidian-compatible task list format</p>
        </div>
        <Download size={14} className="ml-auto text-[rgb(var(--text-3))]" />
      </button>
    </div>
  )
}
