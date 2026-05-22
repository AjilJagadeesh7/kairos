// Mutable map populated at runtime from user-defined custom callouts.
// The calloutPlugin reads this on every document update, so new types
// are recognised without restarting the editor.
export const dynamicTypeMap: Record<string, string> = {}
