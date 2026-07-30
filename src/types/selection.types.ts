// Multi-select for the list sidebars. Only one scope holds selection mode at a
// time — entering a new scope replaces whatever the previous one had selected,
// so a stale selection can never be acted on from another screen.

export type SelectionScope = 'notes' | 'canvas' | 'attachments'
