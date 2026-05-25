export type CoreSection = 'general' | 'storage-sync' | 'tags' | 'callouts' | 'ai' | 'keyboard' | 'logs' | 'about'
// 'plugins' and 'marketplace' are built-in extension sections.
// (string & {}) keeps autocomplete for named literals while allowing
// plugin-registered string ids at runtime without a type error.
export type Section = CoreSection | 'plugins' | 'marketplace' | 'updates' | (string & {})

export interface CustomCallout {
  /** Lowercase identifier used in [!TYPE] syntax, e.g. "recipe" */
  type: string
  /** Display label shown in UI, e.g. "Recipe" */
  label: string
  /** Single emoji rendered as the callout icon, e.g. "🍳" */
  emoji: string
  /** Hex color string, e.g. "#f97316" */
  color: string
}
