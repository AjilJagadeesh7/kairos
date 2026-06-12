// LIFO registry of "dismiss the topmost overlay" handlers, consumed by the
// Android hardware/gesture back button (useAndroidBack). Overlays (ModalShell,
// drawers, the mobile nav panel) register a close handler while mounted/open;
// pressing back closes the most recently opened overlay before any navigation
// happens. Handlers stay on the stack until their overlay unregisters them —
// the overlay's own close → unmount → cleanup removes the entry.

type BackHandler = () => void

const stack: BackHandler[] = []

/** Register an overlay close handler. Returns the unregister cleanup. */
export function registerBackHandler(handler: BackHandler): () => void {
  stack.push(handler)
  return () => {
    const i = stack.lastIndexOf(handler)
    if (i !== -1) stack.splice(i, 1)
  }
}

/** Invoke the topmost overlay handler, if any. True if back was consumed. */
export function handleOverlayBack(): boolean {
  const top = stack[stack.length - 1]
  if (!top) return false
  top()
  return true
}
