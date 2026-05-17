export type CoreSection = 'general' | 'storage-sync' | 'tags' | 'ai' | 'about'
// 'plugins' and 'marketplace' are built-in extension sections.
// (string & {}) keeps autocomplete for named literals while allowing
// plugin-registered string ids at runtime without a type error.
export type Section = CoreSection | 'plugins' | 'marketplace' | (string & {})
