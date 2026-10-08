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

### P2 acceptance criteria (page bubble on boards)

- [x] Summary counts match the board exactly (facts from code) — `agent/boardFacts.ts`
      uses the board UI's own done/overdue helpers; the counts are rendered by code in
      the bubble (`BoardFactsView`), and the model is told to use only those numbers.
      Unit-tested against a fixture and checked in the browser against the column headers
- [x] Plan card with per-action checkboxes, Apply, and batch Undo — `PlanCard`; Apply
      commits the whole plan as one store write (`commitBatch`, one board-history entry,
      so board Ctrl+Z also reverts it as one step); the Undo toast lasts 10 s
- [x] Actions referencing unknown card IDs or columns are shown as unresolved, never
      executed — `agent/boardPlan.ts` resolves every id/column in code; unresolved
      actions are greyed with the reason and have no checkbox; Apply re-checks that each
      card/column still exists

P2 decisions:

- **Tools in the bubble**: the board is already in the prompt, so the board scope offers
  only the three write tools (`create_card`, `update_card`, `move_card`) through
  `callTools`. The read tools (`get_board`, `list_cards`) arrive with the global chat.
- **Tool arguments** differ slightly from the PRD table, for small models:
  - `boardId` is implied by the bubble's page.
  - Cards are named by key (`KAI-4`) rather than UUID.
  - `update_card` takes flat fields with `addTags` / `removeTags` instead of a nested
    `fields` object and a full tag list, so a model can't wipe tags by accident.
  - `priority` can be set.
- **Card resolution**:
  - A card resolves by key, by id, or by an exact title that matches only one card;
    anything else is "could not resolve".
  - A column resolves by a case-insensitive match first, then a match ignoring spaces
    and punctuation ("To Do" = "Todo").
  - A second change of the same kind to the same card in one plan is flagged rather
    than applied.
- **Relative dates**: resolved in code (`text/relativeDates.ts`), e.g.
  "tomorrow" → "tomorrow (2026-10-09)", before the model sees the message. A bare or
  "next" weekday means the first such day after today. The plan card always shows the
  exact date before Apply.
- **"Blocked"**: Kairos has no blocked flag. A card counts as blocked when it sits in a
  column named like Blocked / On hold / Waiting, or carries a tag like `blocked` or
  `blocker`.
- **Counts**: there are two kinds of count.
  - Each column's count is its top-level cards, which matches the column header.
  - "Total issues" includes sub-issues, which matches the Summary tab.
- **Large boards**: when the card list doesn't fit the budget, the cards that match the
  message come first (key mentions, then word overlap), and the prompt says how many
  cards were left out. Counts always come from the facts.
- **Undo**:
  - Undo reverts only what is still as the plan left it. A field the user edited
    afterwards keeps the user's value.
  - A card the plan created that the user has since edited, commented on or nested
    under is kept, and the bubble says so.
  - Kairos has no per-card trash, so this is how user work is protected.
- **Thinking**: `GEN.plan` sets `thinking: true` per the PRD; like P1 it is not yet
  mapped to a provider parameter.
- **Shared bubble core**:
  - `useBubbleSession` holds the session, history and save logic.
  - `PageAiBubble`, `BubblePanelShell` and `BubbleMessageFrame` hold the button, panel
    and message frame.
  - Note and board bubbles both build on these; P1 behaviour is unchanged (its browser
    smoke test passes as before).
- **Command palette / shortcut**: "Ask AI about this page" and `toggle-ai-bubble` work
  on `/notes/:id` and `/kanban/:boardId` (not on task pages).
- **Eval**: `npm run ai:eval` now also runs `boardBubble.eval.ts`:
  - plan accuracy on 6 requests (missing or extra actions fail);
  - invented numbers in the summary;
  - intent routing (≥ 80%).

### P3 acceptance criteria (note to tasks)

- [x] Each created card links back to its source note — cards are created with
      `linkedNotes: [noteId]` (`agent/taskPlanActions.ts`); checked in the browser on the
      card's Linked notes section
- [ ] On a test set of 10 meeting notes, ≥ 80% of action items are extracted without
      invented items — the test set and scorer exist (`eval/noteTasks.eval.ts`,
      `npm run ai:eval`) but have **not been run against a real model yet**

P3 decisions:

- **Two sources of items**:
  - Unchecked `- [ ]` lines are found by code, so they are never missed.
  - Prose action items come from the model.
  - Every model item must carry a verbatim `quote`. Code checks the quote is in the
    note, ignoring markdown/punctuation, with ≥ 85% word overlap as a fallback. An item
    that fails is shown greyed as "Not found in the note" and is never created.
  - Items quoting a `[x]` line are flagged "Already done in the note".
- **Board and column picker** live in the plan card. The default is the last board
  used, else the first board, and its first non-done column. The pick is remembered in
  `useAiStore.taskTarget` (device-local).
- **Re-running** on the same note flags items already on the chosen board as cards
  linked to this note with the same title ("Already on Release as REL-1"), so nothing
  is duplicated.
- **Selection**: with text selected, only the selection is read. Long notes are read in
  parts, never cut. More than 20 usable items is refused with a request to select less
  (PRD max 20 actions).
- **Thinking** is on for extract_tasks (PRD); dates are resolved in code as in P2.

### P4 acceptance criteria (global chat, read-only)

- [x] Index builds on demand with progress and pause; encrypted at rest. Per the
      encryption decision above, it is **stored like notes** (device-local IndexedDB
      `aiChunks`, Dexie v14, never synced).
  - Settings → AI → Semantic index has Build / Pause / Resume / Update / Rebuild /
    Delete, a progress bar and the index size.
  - Incremental: unchanged notes are skipped.
  - Notes saved after the build are re-embedded, debounced 5 s and only while the app
    is in the foreground.
  - Verified on the production build: the index builds with 384-dim MiniLM vectors, and
    "which database engine?" finds the Postgres note with no shared words.
- [x] Every answer that uses vault data shows source chips.
  - Pending and review answers list the cards and notes in their facts.
  - Q&A lists the retrieved notes, numbered as cited ([1], [2]…), cited ones first.
  - Each chip opens its note, journal day or card.
- [x] Review numbers match computed facts exactly. Pending and day/week/month reviews
  are computed in code (`agent/vaultFacts.ts`, using the board UI's done/overdue rules)
  and rendered by code (`VaultFactsView`); the model may only use those numbers.
- [x] Chat threads persist locally and respect the retention setting.
  - Global threads save after every turn and reopen with their facts and chips.
  - Retention options: keep / 30 days / never ("never" deletes saved chats and stops
    saving).
  - Swept at startup and hourly; Clear all is in Settings.

P4 decisions:

- **Retrieval** is hybrid when the on-device index exists:
  - Keyword search (MiniSearch over chunks: title ×3, tags ×2, heading ×2, text)
    always runs on the vault as it is now.
  - Vectors from the index are fused in by reciprocal-rank fusion.
  - A vector whose note changed since it was indexed is ignored until re-indexed.
  - Top 8 passages, at most 3 per note.
  - The answer's meta line says whether semantic search took part.
- **Embedding sources**: on-device (the existing MiniLM worker, both builds) or keyword
  only. Provider embeddings stay in P6 with the other provider work.
- **Global intents**: pending, review (day/week/month), query (optional since/tags),
  change, chitchat. The router sees only the message. "change" is refused in P4 with a
  pointer to the page bubble; writes are P5.
- **Kanban activity for reviews**: `mutateBoard` now stamps `movedAt` when a card
  changes column. It sets `completedAt` on entering the done column and clears it on
  leaving. Moves made before this version aren't recorded.
- **Chat page**: `/chat/:chatId?`, a single route so saving a new thread doesn't
  remount it.
  - Listed in the Activity bar, mobile nav and command palette (AI only).
  - Threads are searchable in Ctrl+K.
  - Saved bubble conversations are read-only and offer "Continue as global chat", which
    opens a new thread with that conversation attached.
- **Add context** (deferred from P1): a paperclip in the global chat and both bubbles.
  - It attaches earlier conversations as an `<earlier_conversations>` data block, using
    up to 25% of the budget.
  - Trimmed to the latest lines, or map-reduced into a summary when trimming would drop
    more than half.
  - In the bubbles it feeds the question flows only. It never widens what a surface can
    do.
- **Deleting chats** asks for confirmation but doesn't go through the trash: chat
  history is device-local AI data, not vault content, and the PRD's retention and
  Clear all already remove it.
- **Fixed on the way**:
  - The embedding worker now sets `env.allowLocalModels = false`. Before, transformers.js
    asked the app's own server for `/models/…`, got the SPA's index.html, and failed, so
    on-device embeddings, and with them the existing semantic search, never worked in
    the built app.
  - The worker now reports its error instead of returning an empty vector silently.
- **Known issue (dev server only)**: under `npm run dev`, transformers.js fails with
  "registerBackend of undefined" because `@xenova/transformers` is excluded from Vite's
  dependency pre-bundling. Production builds work. The exclusion was left as it is.

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
