# AI assistant — decisions and amendments to the PRD

The PRD ("Kairos On-Device AI Assistant", Oct 8 2026) is the spec. This file
records what was decided after reading the codebase, and overrides the PRD
where they disagree.

## Resolved decisions (2026-10-08)

| Topic | Decision |
| --- | --- |
| At-rest encryption of AI data | **Same protection as notes** (PRD option b). Notes are not encrypted at rest today, so chat history, embeddings and the semantic index are stored like notes: device-local IndexedDB, not encrypted. Every PRD line saying "encrypted with the vault key" reads as "stored like notes". |
| API keys | OS secure storage only (Android Keystore via `@aparajita/capacitor-secure-storage`; OS keychain via the `keyring` crate on desktop). Never written to the vault, localStorage, settings files, logs or exports. **Never synced.** |
| Existing WebDAV / S3 credentials | Moved to secure storage in the same change. The opt-in `secrets.json` cloud sync keeps working (it is an explicit user opt-in), but nothing is written to `vault/config/settings.json` or localStorage in plain text any more. |
| Build order | **Providers first.** Agent core + OpenAI-compatible provider (covers Ollama, LM Studio, llama-server, OpenRouter, Groq, OpenAI itself) ship before the on-device runtime. The native llama.cpp work moves to the end. |
| Journal | Journal entries count as notes for retrieval, facts and reviews. |

## Revised phase order

| # | Phase | PRD origin |
| --- | --- | --- |
| P0 | Provider foundation: `LLMProvider`, OpenAI-compatible adapter, native streaming HTTP, secure storage, AI settings, consent, debug chat | parts of PRD Phase 0 + Phase 6 |
| P1 | Page bubble on notes | PRD Phase 1 |
| P2 | Page bubble on boards | PRD Phase 2 |
| P3 | Note to tasks | PRD Phase 3 |
| P4 | Global chat, read-only | PRD Phase 4 |
| P5 | Global chat, writes | PRD Phase 5 |
| P6 | Anthropic + Gemini native adapters, provider embeddings | rest of PRD Phase 6 |
| P7 | Opt-in web access | PRD Phase 7 |
| P8 | On-device runtime (llama.cpp, Full/Lite flavors, model download) | rest of PRD Phase 0 |

### P0 acceptance criteria

- [ ] Tokens from an OpenAI-compatible server (e.g. Ollama) stream into the debug chat on desktop and Android
- [ ] Stop aborts generation within 500 ms
- [ ] `generateJSON` returns schema-valid output for the test schema 20/20 times (debug chat → "JSON check ×20")
- [ ] API keys exist only in OS secure storage — not in the vault, localStorage, settings files or logs
- [ ] WebDAV / S3 secrets are migrated out of `settings.json` and localStorage on first start
- [ ] A cloud provider receives no request (including Test connection) before its consent dialog is accepted
- [ ] Plain HTTP is refused for anything but localhost / private LAN addresses
- [ ] With the AI toggle off, the AI code makes no network requests and loads nothing

### P1 acceptance criteria (page bubble on notes)

- [x] Diff UI for rewrite with Accept / Reject / Retry — word diff in the bubble, and the
      original struck / proposal highlighted inline in the note (`aiSuggestionPlugin`)
- [x] Nothing is written to a note without Accept — previews are decorations only;
      the note changes only in `aiEditorBridge.applyPreview` / `insertAtTop`, called
      only from Accept / "Insert at top" / "Use" / "Add tags" clicks
- [x] Notes longer than the context budget are summarized via map-reduce, not truncated
      (`agent/condense.ts`; a selection too long to rewrite is refused with a message)

P1 decisions:

- **Budget**: prompt budget = the provider's `contextTokens`, capped at 32k. Order:
  system → facts → page → last 4 turns; the page is condensed, never cut.
- **Routing**: free-text messages go through a JSON intent router that sees only the
  user's message, never note content.
- **Chat history**: Dexie table `aiChats` (schema v13), device-local. Bubble sessions
  are saved on close/clear as "Bubble · <title>" with `source` (page id) and
  `attachedChatIds` (empty for now) for the future graph view.
- **Deferred**: "Add context" (attach earlier conversations) moves to P4 with the chat
  page that lists them; "Turn this into tasks" is P3.
- **Thinking**: `GenOpts.thinking` is not yet mapped to a provider parameter for
  OpenAI-compatible servers (Ollama documents `reasoning_effort` but not its values);
  inline `<think>` blocks are stripped from output instead.
- **Fixed on the way**: `calloutPlugin` re-stamped classes on every update, which made
  ProseMirror redraw in a loop in any note with a callout (clicks and selections lost).
  The stamp pass is now idempotent.

## Fixed contradictions in the PRD

1. **CI builds Lite only.** PRD Phase 0's "CI produces Full and Lite builds"
   is replaced by: *CI builds and publishes Lite only; the Full build is
   produced locally by a documented `build:full` script and never by CI.*
   The current `release.yml` already builds a single variant with no
   llama.cpp, i.e. Lite; P8 adds the flavor/feature split and the local script.
2. **Network-silence check is scoped to AI.** PRD Phase 7's "with web access
   off, the app makes no network requests other than model downloads" becomes:
   *with web access off, **AI features** make no network requests other than
   model downloads and calls to the user's chosen provider.* The app's other
   traffic (desktop updater, mobile OTA manifest, sync, the existing
   semantic-search embedding model download) is out of scope for this check.

## Notes for later phases

- `notesApi.update` (plugin API) re-implements the note save path; route it
  through `useAppStore.updateNote` before the agent core depends on it.
- Kanban columns carry `isDone` — use it for "done"/overdue facts instead of
  matching the column name.
- Tasks already have `linkedNotes`; use it for `sourceNoteId`.
- The existing MiniLM embedder (`src/workers/embedding.worker.ts`) works in
  both builds with no native code; reuse it as the on-device embedder in P4.
- **Native release**: P0 adds a Capacitor plugin and a local native plugin and
  enables cleartext HTTP (needed for LAN servers). The release that ships it
  must bump `otaMinNative` in `package.json` to its own version.
