import html2pdf from 'html2pdf.js'
import { save } from '@tauri-apps/plugin-dialog'
import { writeFile } from '@tauri-apps/plugin-fs'

export async function exportPDF(editorRoot: HTMLElement | null, noteTitle: string): Promise<void> {
  const editorEl = editorRoot?.querySelector('.milkdown .ProseMirror')
  if (!editorEl) return
  const clone = editorEl.cloneNode(true) as HTMLElement

  // ── 1. Transform .label-wrapper into plain-text markers ──
  clone.querySelectorAll('.label-wrapper').forEach((lw) => {
    const checked   = lw.querySelector('.checked')
    const unchecked = lw.querySelector('.unchecked')
    const ordered   = lw.querySelector('.ordered')
    const span = document.createElement('span')
    span.style.cssText = 'flex-shrink:0;margin-right:6px;user-select:none'

    if (checked) {
      span.textContent = '☑'
      span.style.color = '#16a34a'
      lw.replaceWith(span)
    } else if (unchecked) {
      span.textContent = '☐'
      lw.replaceWith(span)
    } else if (ordered) {
      const li = lw.closest('li')
      const parentList = li?.parentElement
      const index = parentList
        ? Array.from(parentList.children).filter((el) => el.tagName === 'LI').indexOf(li as HTMLLIElement) + 1
        : 1
      span.textContent = `${index}.`
      lw.replaceWith(span)
    } else {
      span.textContent = '•'
      lw.replaceWith(span)
    }
  })

  // ── 2. For code blocks that have a rendered preview (e.g. LaTeX),
  //        remove the raw CodeMirror editor; keep only the rendered output ──
  clone.querySelectorAll('.milkdown-code-block').forEach((block) => {
    if (block.querySelector('.preview-panel')) {
      block.querySelector('.codemirror-host')?.remove()
    }
  })

  // ── 3. Remove all remaining Milkdown UI chrome ──
  const uiSelectors = [
    '.milkdown-block-handle',
    '.milkdown-table-block-operation-area',
    '.milkdown-table-block-col-handle',
    '.milkdown-table-block-row-handle',
    '[class*="table-block-op"]',
    '[data-type="block-handle"]',
    '.crepe-toolbar',
    '.milkdown-toolbar',
    '.milkdown-top-bar',
    '.slash-menu',
    '.link-tooltip',
    '.add-button',
    '.col-drag-handle',
    '.row-drag-handle',
    '.button-group',
    '.operation',
    '.image-resize-handle',
    '.caption-input',
    '.uploader',
    '.confirm',
    '.milkdown-code-block .tools',
    '.language-picker',
    '.preview-divider',
    '.preview-label',
    '.cm-gutters',
  ]
  uiSelectors.forEach((sel) => {
    clone.querySelectorAll(sel).forEach((el) => el.remove())
  })

  // ── 4. Wrap in a styled container ──
  const container = document.createElement('div')
  container.style.cssText = [
    'font-family:Georgia,"Times New Roman",serif',
    'max-width:780px',
    'margin:0 auto',
    'padding:48px 24px',
    'color:#1a1a1a',
    'line-height:1.7',
    'font-size:15px',
  ].join(';')

  const titleEl = document.createElement('h1')
  titleEl.textContent = noteTitle
  titleEl.style.cssText = 'font-size:26px;margin:0 0 24px'
  container.appendChild(titleEl)
  container.appendChild(clone)

  const style = document.createElement('style')
  style.textContent = `
    h1{font-size:26px;margin:0 0 6px}h2{font-size:21px}h3{font-size:17px}
    p{margin:0.9em 0}
    code{background:#f3f4f6;padding:2px 5px;border-radius:3px;font-family:monospace;font-size:0.87em}
    pre{background:#f3f4f6;padding:16px;border-radius:6px;overflow-x:auto}
    pre code{background:none;padding:0}
    .milkdown-code-block{background:#f3f4f6;border-radius:6px;padding:12px 16px;margin:1em 0;overflow-x:auto}
    .milkdown-code-block .cm-editor{font-family:monospace;font-size:0.87em}
    .milkdown-code-block .cm-line{padding:0;white-space:pre-wrap}
    .milkdown-code-block .cm-content{padding:0}
    .preview-panel{margin:0.5em 0}
    table{border-collapse:collapse;width:100%;margin:1em 0}
    td,th{border:1px solid #ccc;padding:4px 10px;text-align:left;vertical-align:middle}
    th{background:#f9fafb;font-weight:600}
    td p,th p{margin:0;padding:0;line-height:1.4}
    blockquote{border-left:3px solid #d1d5db;margin:0;padding-left:16px;color:#6b7280}
    img{max-width:100%;height:auto;display:block}
    .milkdown-image-block{margin:1em 0}
    a{color:#2563eb}
    hr{border:none;border-top:1px solid #e5e7eb}
    [data-show="false"]{display:none!important}
    ul,ol{padding-left:0;margin:0.5em 0;list-style:none}
    .milkdown-list-item-block{display:block;margin:0.2em 0;padding-left:1.5em}
    .milkdown-list-item-block .list-item{display:flex;align-items:baseline;list-style:none;margin:0;padding:0}
    .milkdown-list-item-block .list-item .children{flex:1;min-width:0}
    .milkdown-list-item-block .list-item .children p{margin:0}
  `
  container.insertBefore(style, container.firstChild)

  const safeFilename = noteTitle.replace(/[^\w\s-]/g, '').trim() || 'note'

  // ── 5. Show native save-as dialog then write the file ──
  const savePath = await save({
    defaultPath: `${safeFilename}.pdf`,
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  })
  if (!savePath) return  // user cancelled

  const pdfBlob: Blob = await html2pdf()
    .set({
      margin:      [12, 12, 12, 12],
      filename:    `${safeFilename}.pdf`,
      image:       { type: 'jpeg', quality: 0.95 },
      html2canvas: { scale: 2, useCORS: true, logging: false },
      jsPDF:       { unit: 'mm', format: 'a4', orientation: 'portrait' },
      // @ts-expect-error — html2pdf.js types omit the pagebreak option
      pagebreak:   { mode: ['avoid-all', 'css', 'legacy'] },
    })
    .from(container)
    .outputPdf('blob')

  const bytes = new Uint8Array(await pdfBlob.arrayBuffer())
  await writeFile(savePath, bytes)
}
