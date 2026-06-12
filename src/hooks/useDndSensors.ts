import { MouseSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core'

// Shared dnd-kit sensor setup for every drag surface (kanban board, subtasks,
// column manager, pane tabs).
//
// A bare PointerSensor with a distance constraint makes touch unusable: any
// 6px finger movement on a draggable starts a drag, so swiping to scroll a
// kanban column grabs a card instead. Splitting by input type fixes it:
//   - mouse: drag after a small movement, clicks still register
//   - touch: long-press (250ms) to lift; quick swipes scroll naturally
export function useDndSensors(distance = 6) {
  return useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
  )
}
