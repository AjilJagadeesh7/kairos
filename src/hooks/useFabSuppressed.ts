import { useEffect, useState } from 'react'

// Whether the mobile floating nav button should get out of the way:
//   - while the on-screen keyboard is open (the fixed FAB rides up over the
//     text being typed) — detected via visualViewport shrinking
//   - while a pointer is down on a <canvas> (pen notes, canvas boards, graph),
//     so strokes and drags near the corner aren't covered mid-gesture
export function useFabSuppressed(): boolean {
  const [suppressed, setSuppressed] = useState(false)

  useEffect(() => {
    let keyboardOpen = false
    let drawing = false
    const update = () => setSuppressed(keyboardOpen || drawing)

    const vv = window.visualViewport
    const onViewport = () => {
      keyboardOpen = vv ? window.innerHeight - vv.height > 150 : false
      update()
    }
    vv?.addEventListener('resize', onViewport)

    const onPointerDown = (e: PointerEvent) => {
      if ((e.target as Element | null)?.closest('canvas')) {
        drawing = true
        update()
      }
    }
    const onPointerEnd = () => {
      if (drawing) {
        drawing = false
        update()
      }
    }
    window.addEventListener('pointerdown', onPointerDown, true)
    window.addEventListener('pointerup', onPointerEnd, true)
    window.addEventListener('pointercancel', onPointerEnd, true)

    return () => {
      vv?.removeEventListener('resize', onViewport)
      window.removeEventListener('pointerdown', onPointerDown, true)
      window.removeEventListener('pointerup', onPointerEnd, true)
      window.removeEventListener('pointercancel', onPointerEnd, true)
    }
  }, [])

  return suppressed
}
