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

### P5 acceptance criteria (global chat, writes)

- [x] All writes go through plan and confirm; max 20 actions per plan.
  - A change request becomes a plan card in the chat (`agent/globalPlanRun.ts`). Apply
    is the only write path (`hooks/useGlobalPlan.ts`).
  - The whole plan is one batch with one 10-second Undo across boards and notes.
  - Plans over 20 actions are refused with a request to narrow it down.
  - Unit tests check the vault is unchanged until Apply. The browser smoke test checks
    the stores before and after Apply and Undo.
- [x] Instructions embedded in note content do not trigger actions. Prompt-injection
  test notes are in the test suite (`agent/__fixtures__/injection.ts`,
  `globalPlanRun.test.ts`, and the injection cases in `eval/globalPlan.eval.ts`):
  - The router sees only the user's message. Questions, pending and reviews never
    offer the model a tool. The tests use a model that "obeys" the notes and show no
    tool call and no write.
  - In a change request, vault text and lookup results are data blocks. Fake closing
    tags inside notes are neutralised.
  - Even a model that obeys the notes only produces a proposal.
  - If anything read for the plan addresses an AI (`text/injection.ts`), the plan
    card names it, starts with **nothing selected**, and Apply stays disabled until
    the user ticks changes themselves. This was checked in the browser.

P5 decisions:

- **What the model sees is chosen by code**:
  - every board's columns and tags;
  - the cards most relevant to the request across all boards (all of them when they
    fit);
  - passages from the hybrid retrieval;
  - what's pending.
- **Read tools** (`search_notes`, `get_note`, `list_cards`, `get_board`):
  - The model may use them for at most 2 rounds of up to 4 calls each.
  - They run in code and return results in a `<tool_results>` data block. The last
    round offers only write tools.
  - Read and write tools together are 9 (PRD: at most 10).
- **allowedIds**:
  - A card or note may appear in an action only if it was in what the model was shown
    in that request (context or lookups). Anything else is greyed as "wasn't among the
    cards the assistant was shown".
  - Boards resolve from the full board list.
  - When two boards share a key, the model must name the board.
- **Write tools**: `create_note`, `create_card` (any board, optional `sourceNoteId` →
  linked note), `update_card`, `move_card`, `link_notes`. `update_note` and `add_tag`
  stay in the note bubble (P1 suggestions), as in the PRD scopes.
- **New notes**:
  - A title another note already has is refused, since wikilinks go by title.
  - Folders must exist.
  - Tags become `#tags` in the body, which is how Kairos tags work.
  - A link may point to, or come from, a note the same plan creates.
- **Apply order**: new notes, then links, then each board as one write
  (`agent/globalApply.ts`, through a `VaultWriter` the hook implements with the existing
  stores). `createNote` gained `activate: false`, so an AI-created note doesn't change
  the open note.
- **Undo**:
  - It reverts boards, links and new notes, newest first.
  - A note the plan created is removed through `deleteNoteById`, so it is captured in
    the trash first, never hard-deleted.
  - A note or link the user edited since is kept and named.
- **Prompts**: `globalPlan.v1`. The read-flow prompt moved to `globalChat.v2`, which tells
  users how to ask for a change instead of saying changes are impossible.
- **Eval**: `npm run ai:eval` adds `globalPlan.eval.ts`, with 4 plan cases and 3
  injection cases. None of it has been run against a real model yet.

### P6 acceptance criteria (custom providers: Anthropic, Gemini, provider embeddings)

APIs were checked against the official docs in Oct 2026:
- Anthropic: `POST /v1/messages`, `anthropic-version: 2023-06-01`, the SSE events,
  `output_config.format`, `GET /v1/models`.
- Gemini: `generateContent`, `streamGenerateContent?alt=sse`,
  `functionDeclarations[].parametersJsonSchema`, `responseJsonSchema`, `thinkingConfig`,
  `batchEmbedContents`, `models.list`.
- OpenAI / Ollama: `POST /embeddings`.

- [x] All Phase 1–5 features work unchanged with each provider type.
  - `agent/crossProvider.test.ts` runs a P1 rewrite, a P2 board plan, a P4 question
    with sources and a P5 global plan through each real adapter, using recorded wire
    replies.
  - The browser smoke test runs Claude and Gemini mock servers through the app.
  - Feature code never branches on the provider.
- [x] Tool calls use each provider's native format.
  - Anthropic `tools[].input_schema` → `tool_use` blocks.
  - Gemini `functionDeclarations` → `functionCall` parts.
  - OpenAI `tools[].function`.
  - If a model rejects tools, the adapter falls back to schema-in-prompt JSON, validated
    and retried once (shared `HttpProvider.callTools`).
- [x] A cloud provider gets no request before its consent dialog is accepted, and that
  now includes embeddings: `embeddingProviderFromConfig` goes through the same gate.
  Registry tests check that no request is sent before consent.
- [x] API keys never appear in vault data, sync payloads, logs or exports.
  - Keys for every type come from secure storage only.
  - Tests check that the persisted AI settings never contain the key. The browser test
    checks localStorage after saving Claude and Gemini.
- [x] Provider failures show a clear error with Switch provider, and there's no silent
  fallback. Each adapter maps its errors to the same kinds: Anthropic 401/529 and
  error events, Gemini 429 `RESOURCE_EXHAUSTED` and blocked prompts.

P6 decisions:

- **Adapters**:
  - `providers/httpProvider.ts` holds what all of them share: abort tracking, error
    mapping, retrying without a parameter the server rejected, validated JSON with one
    retry, and the tool-call fallback.
  - `openaiCompat.ts`, `anthropic.ts` and `gemini.ts` (with their `*Wire.ts` files) only
    speak their formats.
  - Adding a provider type takes an adapter file, a case in `registry.adapterFor`, and a
    preset.
  - OpenAI itself uses the OpenAI-compatible adapter, which already does native function
    calling and `json_schema`.
- **Parameters that some models reject**:
  - Newer Claude models reject `temperature`, so it's dropped on a 400 and the adapter
    remembers that.
  - Thinking (`GenOpts.thinking`) maps to Anthropic `thinking: {type: 'adaptive'}`
    (no temperature) and to Gemini's default thinking. When thinking is off, Gemini gets
    `thinkingBudget: 0`, dropped if the model refuses it.
  - Thinking gets 4,096 extra output tokens so it can't crowd out the answer.
  - Structured-output schemas are reduced to what each API accepts. Our validator
    still checks the full schema.
- **Provider embeddings**:
  - The embedding source can be on-device, provider or keyword only.
  - The provider source uses the provider's `embeddingModel`: Ollama/OpenAI
    `/embeddings`, or Gemini `batchEmbedContents` with the RETRIEVAL_DOCUMENT/QUERY task
    types. Claude has none, and the editor says so.
  - The index records `type:host:model`. Changing any of them shows "rebuild to use it",
    and semantic search stays off until then.
- **Token usage**: counted per month on the device from each provider's usage fields
  (Settings → AI → Token usage). There's an optional threshold, and a warning toast shows
  once a month when it's passed.
- **Desktop/Android**: the native HTTP layers pass any headers and allow any HTTPS host,
  so no native change was needed for P6.
- **Evals**: `AI_EVAL_TYPE=anthropic|gemini` runs every eval through that adapter.
- **Not verified**: real Anthropic and Gemini accounts (only mock servers built from the
  documented formats), the desktop app and Android.

### P7 acceptance criteria (opt-in web access)

APIs were checked in Oct 2026:
- SearXNG `GET /search?q=…&format=json` (docs.searxng.org).
- Brave `GET https://api.search.brave.com/res/v1/web/search` with `X-Subscription-Token`.
- DuckDuckGo's `html.duckduckgo.com/html/` markup, from a live page. That page is now
  the test fixture.

- [x] With web access off, AI features make no network requests other than calls to
  the chosen provider (scope amended above).
  - Checked with a network monitor in the browser (Playwright `page.on('request')`) over
    a question, a web-sounding question, pending, and a change plan.
  - The only origins were the provider and, outside the AI scope, the app's UI font
    from Google Fonts.
  - In code, `env.web` is null unless web access is on and tested, and the web modules
    aren't even loaded. Unit tests check that no web intent or tool is offered and that
    `fetch` is never called.
- [x] Test connection checks the SearXNG URL, Brave key or DDG scraper before the toggle
  can be turned on.
  - It runs one real search, or reads example.com for fetch-only.
  - The toggle stays disabled until then, and changing the provider, URL or key turns it
    off again.
  - Checked in the browser with a SearXNG mock and in store tests.
- [x] With confirmation on, no query or fetch is sent without approval.
  - Every search shows its exact query, and every page read shows its URL, in an
    Allow / Don't allow card.
  - Don't allow (or Stop) sends nothing and ends the lookups.
  - The network monitor showed nothing reaching the search host after Don't allow, and
    only the two approved requests after Allow.
- [x] Injection test pages don't cause any write to run.
  - Page extraction drops scripts, navigation and hidden text (`hidden`, `aria-hidden`,
    `display:none`, zero-size or zero-opacity, offscreen elements, comments).
  - What's left goes to the model in a `<web_content>` or `<tool_results>` data block.
  - Web questions offer only the two web tools.
  - In a change plan that read a page with instructions aimed at an AI, the plan is
    flagged and starts with nothing selected; that's the same guard as P5.
  - Covered by unit tests (`web.test.ts`, `webActions.test.ts`) and in the browser:
    KAI-1 stayed untouched.

P7 decisions:

- **Where web lives**:
  - A new `web` intent, offered to the router only when web access is on, runs
    `agent/webActions.ts`.
  - Links pasted in the message are read first.
  - The model then writes its own search query from the user's message alone (no note
    text is in that prompt), and may read up to 3 pages per round, for 3 rounds.
  - Change plans can also use `web_search` / `fetch_url` when web is on. `get_board` makes
    room so the model never sees more than 10 tools.
  - The page bubble never has web tools.
- **Providers**:
  - Files: `providers/search/searxng.ts`, `brave.ts` and `ddg-scraper.ts`.
  - They sit behind one `SearchProvider` interface and go through the native HTTP layer.
  - The Brave key is kept in OS secure storage, like the other keys.
- **DuckDuckGo**:
  - The only JS port (`duck-duck-scrape`, last release Jan 2025) runs on Node's HTTP
    stack and can't use the native layer, so the parser is written in-house.
  - It allows 1 request per 2 s with a browser user agent.
  - On a CAPTCHA or rate limit it backs off for 60 s and doesn't retry.
  - If a full page yields nothing, it reports that DuckDuckGo's layout changed and
    suggests SearXNG or Brave.
  - It is never picked automatically.
  - In the browser dev server DDG is blocked by CORS. It works only through the
    desktop and Android native HTTP layers, which haven't been tested.
- **Pages**:
  - HTTPS only, except local addresses (same rule as providers).
  - The domain allowlist and blocklist are checked before asking, so a blocked domain is
    never even offered.
  - At most `maxPageBytes` are read (default 1 MB), and the extracted text is trimmed to
    about 2,500 tokens. Being cut is stated, not silent.
- **Source chips**: pages are numbered and cited like notes. Web chips show the host
  and open in the system browser.
- **Prompts**: `web.v1`. The router's `web` intent is part of `globalChat.v2`.
- **Not verified**: a real SearXNG instance, a Brave key, and DDG through the native
  layers.

### P8 acceptance criteria (on-device runtime, Full/Lite)

Checked in Oct 2026:
- Models: [openbmb/MiniCPM5-1B-GGUF](https://huggingface.co/openbmb/MiniCPM5-1B-GGUF) and
  [openbmb/MiniCPM5-2B-GGUF](https://huggingface.co/openbmb/MiniCPM5-2B-GGUF) (Apache-2.0).
  Q4_K_M is 688,065,920 and 1,561,318,368 bytes. Both downloads matched their pinned SHA-256.
- Runtime: `llama-cpp-2` / `llama-cpp-sys-2` 0.1.159. These vendor llama.cpp commit `26394b4e`;
  Android builds from that same commit.
- Dependencies approved on 2026-10-09:
  - `llama-cpp-sys-2`, 5.6 MB.
  - LLVM 23.1.3 (libclang, for bindgen), installed with winget.
  - Android NDK r27c and CMake 3.22.1, installed automatically by Gradle.

- [ ] CI produces Full and Lite builds — **amended**: CI builds Lite only; Full is built
  locally (see "Fixed contradictions").
  - [x] Lite contains no llama.cpp native libraries:
    - The Lite APK has no `.so` at all; the Full APK has `lib/arm64-v8a/libkairos_llm.so` (12 MB).
    - Tauri without `local-llm` doesn't link llama.cpp.
    - The Lite web bundle contains none of the on-device code, catalog or UI (5 markers
      absent); a Full build contains all of them.
  - CI now runs `assembleLiteRelease` / `bundleLiteRelease`.
  - Full builds: `npm run build:full:desktop` and `npm run build:full:android`. On Windows the
    script finds LLVM's libclang and Visual Studio's CMake by itself.
- [x] Full build: the model downloads, verifies its SHA-256, loads and streams tokens — on
  desktop. Android is not yet run end to end.
  - **Desktop**, checked in the real Tauri app in an isolated profile, driven over WebView2's
    debug port:
    - Settings → On-device model detected a paused file.
    - Resume verified its SHA-256, and the model was marked ready.
    - "On-device" appeared under Use for, and the chat header showed On-device.
    - The real 2B model answered a question in the global chat, with routing through grammar
      JSON and a streamed reply.
  - **Download manager tests**: 4 Rust tests covering resume, checksum mismatch, pause, and
    pinned models only. The real Hugging Face URL serves Range (206), so resume works there.
  - **Android**:
    - The Full APK builds with the JNI runtime.
    - On an API 37 emulator (16 KB pages) it showed the app had to be **16 KB page-aligned**.
      That's fixed: `-Wl,-z,max-page-size=16384` plus `ANDROID_SUPPORT_FLEXIBLE_PAGE_SIZES`,
      and the segments are now verified at 0x4000.
    - The app started, and the seeded 1B model was copied in.
    - The run was stopped before the on-device chat completed, because the app was removed
      from the emulator mid-test. **Download, verify and generate on Android remain
      unverified.**
- [x] Stop aborts generation within 500 ms. Abort sets a flag the token loop checks before
  every token; at 24 tok/s that's within one token (~40 ms). Not timed in the app.
- [x] `generateJSON` returns schema-valid output.
  - Decoding is constrained by GBNF generated from the schema (`gbnf.ts`).
  - With the real 2B model, llama.cpp accepted the generated grammars. They produced valid
    router JSON (`{"intent": "change"}`) and correct tool calls (`move_card KAI-4 → Done`).
  - Unit tests check the grammars against valid and invalid JSON.
  - The PRD's 20/20 run has not been done with the on-device model.
- [x] With the AI toggle off, no model is loaded and no extra memory is used.
  - The model loads only on the first on-device request (`OnDeviceProvider.ensureLoaded`),
    after `providerForSurface` checks the toggle.
  - The worker thread is idle until then.
  - It unloads after 5 idle minutes, on Delete, or (Android) under memory pressure.

Performance, measured on this PC's CPU with MiniCPM5-2B Q4_K_M in a release build:

| Metric | Measured | PRD target (desktop) |
| --- | --- | --- |
| Model load | 1.27 s | < 3 s |
| Time to first token | 0.44 s | < 1 s |
| Generation | 24.1 tok/s | ≥ 20 tok/s (CPU) |

Android targets have not been measured: the emulator translates ARM, so its numbers wouldn't
mean anything. A mid-range phone is needed.

P8 decisions:

- **Desktop runtime** (`src-tauri/src/local_llm.rs`, `local-llm` feature):
  - llama.cpp runs on a dedicated worker thread that owns the backend and model.
  - Commands: `llm_available`, `llm_load`, `llm_unload`, `llm_generate` (tokens over a Tauri
    Channel), `llm_abort`.
  - It applies the model's chat template (llama.cpp built-in templates), samples with
    grammar → min-p → temperature → dist (greedy at temperature 0), and splits UTF-8 safely
    across tokens.
  - Only `.gguf` files inside the app's models folder can be loaded.
  - It is CPU-only for now: GPU (Vulkan/Metal/CUDA) needs those SDKs at build time and wasn't
    needed to meet the targets.
- **Android runtime** (`full` flavor):
  - `src/full/cpp/kairos_llm.cpp` is a JNI bridge that mirrors the desktop logic.
  - It is built with CMake + NDK r27c for arm64-v8a only.
  - llama.cpp is fetched at build time as a tarball pinned by SHA-256, into a cache outside
    the project. Inside the project, Windows file watchers broke the extract.
  - `LocalLlmPlugin` stops generation when the app is paused, and frees the model under memory
    pressure (`onTrimMemory`). It reloads on the next request.
  - The native build is configured only when a Full task runs, so Lite and CI never need the
    NDK.
- **Thinking**: MiniCPM5 writes `<think>…</think>` before answering. The app already strips
  it, and grammar-constrained JSON can't contain it.
- **Tests**: `local_llm_tests.rs` runs the real model when `KAIROS_TEST_MODEL` is set:
  timings, plain streaming, and grammar-constrained intent and tool-call JSON.
- **Native release**: `MainActivity` (the flavor hook) and the Gradle flavors changed, and Full
  adds native plugins. The release that ships this must bump `otaMinNative`.

### On-device fixes after first use (2026-10-09)

- **Missing BOS token**: this was the cause of the 1B model looping ("the, the, the…",
  "Facts computed from the note…" repeated).
  - MiniCPM5's GGUF template starts with `{{ bos_token }}`, but its tokenizer doesn't flag
    `add_bos`, and llama.cpp's built-in ChatML template doesn't emit it.
  - Both runtimes (`local_llm.rs`, `kairos_llm.cpp`) now prepend BOS when the model's own
    template asks for it.
  - Checked with the user's 1B file, in debug and release builds.
- **Thinking off means off**: when `GenOpts.thinking` is false, the prompt ends with an empty
  `<think></think>`, which is what the model's template does for `enable_thinking=false`.
  Thinking no longer eats summary token budgets.
- **Loop guard**:
  - Plain text (no grammar) uses llama.cpp's DRY sampler (0.8 / 1.75 / 2) and a 1.05 token
    penalty.
  - A strong token penalty (1.15) made the 1B model count ("0, 1, 2, 3…") instead.
  - Grammar-constrained JSON gets no penalties.
- **Model capability**: 1B answers are now coherent but shallow, and it sometimes copies
  examples from the prompt. The 2B model or an API model does much better.

## AI redesign (2026-10-09): open-ended, not fixed modes

The P1–P7 design routed every message into one of a few fixed modes. Trying it, the user
found that far too limiting, even with a strong model. Both surfaces are now open-ended.
The safety rules are unchanged.

**Global chat = agent** (`agent/agentRun.ts`, prompts `agent.v1`):
- **No router.** The model gets the message, a small deterministic overview (boards and
  columns, the cards that fit, the 15 most recently edited notes) and a toolbox. It
  decides what to do over up to 6 steps, then answers in its own words, streamed.
- **Tools**, 7 at most (PRD: ≤ 10):
  - `search_notes`, `read_note`, `list_cards`, and `vault_facts` (exact pending/review
    counts, still shown as the facts card);
  - `web_search` and `fetch_url`, only when web access is on, each with approval;
  - `propose_changes`, a single write tool with up to 20 changes.
- **Changes**: `propose_changes` goes through the same validator and plan card as P5.
  Only cards and notes the agent was shown may be named, and nothing is written until
  Apply. If anything read addresses an AI, the plan is flagged and starts with nothing
  selected.
- **Citations**: every note, journal day and web page read gets a number. The answer
  cites `[n]`, chips show what it cited, and replies render markdown
  (`molecules/MarkdownText`, a small React renderer with no HTML injection and no new
  dependency).
- **Quick buttons** (pending, daily and weekly review) stay deterministic.
- **Removed**: the router (`globalIntent`), `runQuery`, `runChitchat`, the separate
  P5 plan runner and P7 web runner, and the `globalPlan.v1` / `web.v1` prompts.
  `agent.eval.ts` replaces their evals.
- **Model choice**: per surface (Use for), with no automatic capability gating. That is
  the user's choice.

**Page bubble = instructions** (`agent/noteAgent.ts`, `agent/noteEdit.ts`, prompts
`noteAgent.v1`):
- Type anything about the note.
  - A small decision call picks one action: edit the selection or the whole note, insert
    at the cursor / top / end, summarize, title, tags, tasks — or no tool, which means
    answer in the chat.
  - That call sees only the instruction and whether text is selected, never the note
    (PRD: only the user's message decides intent).
  - The user's own words then drive a streamed edit or insert, with the note as data.
  - Every edit is previewed as a diff in the editor with Accept / Reject / Retry.
- **Prompt menu**:
  - 18 presets in Ask / Write / Edit / Organize, including explain, key points, gaps,
    brainstorm, outline, next steps, tighten, expand, simplify, formal, casual, grammar,
    bullets, table, translate, title, tags and tasks.
  - **My prompts**: user-saved instructions, stored device-local in `useAiStore`.
  - Edit presets apply to the selection, or to the whole note when nothing is selected.
- **Removed**: the bubble router (`noteIntent`) and the fixed quick-action strip.

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
