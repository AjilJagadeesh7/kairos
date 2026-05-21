import { RefObject, useState } from 'react'
import { editorViewCtx } from '@milkdown/core'
import { Selection } from '@milkdown/prose/state'
import type { Crepe } from '@milkdown/crepe'
import type { ContextMenuState } from '../types'
import { CLOSED_MENU } from '../types'

export function useEditorContextMenu(
  crepeRef: RefObject<Crepe | null>,
  rootRef: RefObject<HTMLDivElement | null>,
) {
  const [menu, setMenu] = useState<ContextMenuState>(CLOSED_MENU)

  function handleContextMenu(event: React.MouseEvent<HTMLDivElement>) {
    event.preventDefault()
    const crepe = crepeRef.current
    if (!crepe) return
    const target = event.target as HTMLElement

    let kind: ContextMenuState['kind'] = 'default'
    let imageSrc = ''
    let imageNodePos = -1
    let rowIndex = -1
    let colIndex = -1

    let selectedText = ''
    crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx)
      const pos  = view.posAtCoords({ left: event.clientX, top: event.clientY })
      if (pos) {
        // Only move the cursor if there's no active selection (right-clicking into empty space)
        if (view.state.selection.empty) {
          view.dispatch(view.state.tr.setSelection(Selection.near(view.state.doc.resolve(pos.pos))))
        }
        const node = view.state.doc.nodeAt(pos.pos)
        if (node && (node.type.name === 'image' || node.type.name === 'image-block')) {
          kind = 'image'; imageSrc = node.attrs.src as string; imageNodePos = pos.pos
        }
      }
      const sel = view.state.selection
      if (!sel.empty) {
        kind = 'text'
        selectedText = view.state.doc.textBetween(sel.from, sel.to, ' ')
      }
      view.focus()
    })

    const cell = target.closest('th, td') as HTMLTableCellElement | null
    if (cell) {
      const row   = cell.parentElement as HTMLTableRowElement | null
      const table = row?.closest('table')
      rowIndex = row && table ? Array.from(table.querySelectorAll('tr')).indexOf(row) : -1
      colIndex = row ? Array.from(row.children).indexOf(cell) : -1
      kind = 'table'
    }

    const imgEl = target.tagName === 'IMG'
      ? (target as HTMLImageElement)
      : (target.closest('img') as HTMLImageElement | null)
    if (imgEl && kind !== 'table') {
      kind = 'image'; imageSrc = imgEl.src
      crepe.editor.action((ctx) => {
        const view = ctx.get(editorViewCtx)
        const rawPos = view.posAtDOM(imgEl, 0)
        const $p = view.state.doc.resolve(rawPos)
        for (let d = $p.depth; d >= 0; d--) {
          const n = $p.node(d)
          if (n.type.name === 'image' || n.type.name === 'image-block') {
            imageNodePos = $p.before(d); break
          }
        }
        if (imageNodePos < 0) imageNodePos = rawPos
      })
    }

    setMenu({ visible: true, x: event.clientX, y: event.clientY, kind, rowIndex, colIndex, imageSrc, imageNodePos, selectedText })
  }

  function resizeImage(widthPx: number | null) {
    const crepe = crepeRef.current
    if (!crepe || menu.imageNodePos < 0) { setMenu(CLOSED_MENU); return }
    const { imageNodePos: targetPos, imageSrc: storedSrc } = menu
    crepe.editor.action((ctx) => {
      const view = ctx.get(editorViewCtx)
      const { state } = view

      const $pos = state.doc.resolve(targetPos)
      let nodePos = -1
      for (let d = $pos.depth; d >= 0; d--) {
        const n = $pos.node(d)
        if (n.type.name === 'image' || n.type.name === 'image-block') { nodePos = $pos.before(d); break }
      }
      if (nodePos < 0) {
        const direct = state.doc.nodeAt(targetPos)
        if (direct && (direct.type.name === 'image' || direct.type.name === 'image-block')) nodePos = targetPos
      }
      if (nodePos < 0) { view.focus(); return }
      const node = state.doc.nodeAt(nodePos)
      if (!node) { view.focus(); return }

      const liveImg = rootRef.current?.querySelector<HTMLImageElement>(
        `img[src="${CSS.escape(storedSrc)}"]`,
      ) ?? null

      let newRatio = 1
      if (liveImg && liveImg.naturalWidth > 0) {
        let originH = Number(liveImg.dataset.origin)
        if (!(originH > 0)) {
          const host = liveImg.closest('.milkdown-image-block') as HTMLElement | null
          const containerW = host ? host.getBoundingClientRect().width : liveImg.getBoundingClientRect().width
          const maxW = containerW || liveImg.naturalWidth
          originH = liveImg.naturalWidth < maxW
            ? liveImg.naturalHeight
            : maxW * (liveImg.naturalHeight / liveImg.naturalWidth)
          liveImg.dataset.origin = originH.toFixed(2)
        }
        if (widthPx !== null) {
          const aspect = liveImg.naturalHeight / liveImg.naturalWidth
          newRatio = parseFloat(((widthPx * aspect) / originH).toFixed(2))
        }
        const displayH = originH * newRatio
        liveImg.dataset.height = displayH.toFixed(2)
        liveImg.style.height   = `${displayH}px`
      }

      view.dispatch(state.tr.setNodeMarkup(nodePos, undefined, { ...node.attrs, ratio: newRatio }))
      view.focus()
    })
    setMenu(CLOSED_MENU)
  }

  function closeMenu() { setMenu(CLOSED_MENU) }

  return { menu, handleContextMenu, resizeImage, closeMenu }
}
