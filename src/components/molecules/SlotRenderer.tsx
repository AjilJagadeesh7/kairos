import React from 'react'
import { usePluginSlots } from '../../plugins/pluginContext'
import type { SlotId, SlotPropsMap } from '../../plugins/slotTypes'

interface Props<S extends SlotId> {
  slot: S
  props: SlotPropsMap[S]
  className?: string
}

// Renders all plugin components registered for a named slot, ordered by `order` (lower = first).
// Returns null when no plugins have registered into this slot — zero host overhead.
export function SlotRenderer<S extends SlotId>({ slot, props, className }: Props<S>) {
  const entries = usePluginSlots(slot)
  if (!entries.length) return null

  const sorted = [...entries].sort((a, b) => (a.order ?? 50) - (b.order ?? 50))

  return (
    <>
      {sorted.map(entry => {
        const Component = entry.component as React.ComponentType<SlotPropsMap[S]>
        return (
          <div key={`${entry.pluginId}:${slot}`} className={className}>
            <Component {...props} />
          </div>
        )
      })}
    </>
  )
}
