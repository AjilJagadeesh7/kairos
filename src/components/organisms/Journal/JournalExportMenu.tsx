import { Dropdown } from '../../molecules/Dropdown'
import { markdownToHtml } from '../../../utils/markdownToHtml'
import { buildAttachmentZip, inlineHtmlAttachments, hasAttachmentRefs } from '../../../utils/attachmentExport'
import { Icon } from '../../../icons/Icon'

interface JournalExportMenuProps {
  /** File/page title used for the export. */
  title: string
  /** Markdown body to export. */
  markdown: string
}

function downloadBlob(content: string | Uint8Array, filename: string, mime: string) {
  const part: BlobPart = typeof content === 'string' ? content : (content as BlobPart)
  const blob = new Blob([part], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 5000)
}

/** Export dropdown (Markdown / HTML) mirroring the Notes editor export menu. */
export function JournalExportMenu({ title, markdown }: JournalExportMenuProps) {
  const safe = title.replace(/[^\w\s-]/g, '').trim() || 'journal'

  const itemCls = 'flex w-full items-center gap-2.5 px-3 py-2.5 text-sm text-text2 hover:bg-surface2 hover:text-text transition-colors'

  const exportHTML = async () => {
    const body = markdownToHtml(markdown)
    const doc = `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title></head><body><h1>${title}</h1>${body}</body></html>`
    downloadBlob(await inlineHtmlAttachments(doc), `${safe}.html`, 'text/html')
  }

  const exportMarkdown = async () => {
    if (hasAttachmentRefs(markdown)) {
      const { bytes } = await buildAttachmentZip(markdown, `${safe}.md`)
      downloadBlob(bytes, `${safe}.zip`, 'application/zip')
    } else {
      downloadBlob(markdown, `${safe}.md`, 'text/markdown')
    }
  }

  return (
    <Dropdown trigger={
      <div className="flex h-7 items-center gap-1 rounded px-2 text-xs font-medium text-text3 transition hover:bg-surface3 hover:text-text md:px-2.5">
        <Icon name="share" size={12} />
        <span className="hidden md:inline">Export</span>
        <Icon name="chevron-down" size={10} />
      </div>
    }>
      <div className="w-44 overflow-hidden rounded-lg border border-border bg-surface shadow-lg">
        <button type="button" className={itemCls} onClick={() => void exportMarkdown()}>
          <Icon name="file-text" size={14} className="shrink-0 text-text3" />
          Markdown (.md)
        </button>
        <button type="button" className={itemCls} onClick={() => void exportHTML()}>
          <Icon name="globe" size={14} className="shrink-0 text-text3" />
          HTML (.html)
        </button>
      </div>
    </Dropdown>
  )
}
