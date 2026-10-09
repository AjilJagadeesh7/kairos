/** Keeps the editor's selection: a mousedown on bubble buttons must not move focus. */
export const keepSelection = (e: React.MouseEvent) => e.preventDefault()
