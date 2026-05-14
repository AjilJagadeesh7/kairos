const GOLDEN_ANGLE = 137.508
export function colorForIndex(i: number): string {
  return `hsl(${((i * GOLDEN_ANGLE) % 360).toFixed(1)}, 72%, 62%)`
}
