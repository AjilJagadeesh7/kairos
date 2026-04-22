# MindVault

Privacy-first, open-source note-taking web app that runs fully in the browser.

MindVault is local-first by default (IndexedDB), supports encrypted Google Drive sync, visual note graphs, semantic embeddings, and on-device AI chat with retrieval-augmented context.

## Core Stack

- React + Vite + TypeScript
- Tailwind CSS
- Dexie.js (IndexedDB)
- Milkdown (markdown editor)
- Web Crypto API (PBKDF2 + AES-GCM)
- Cytoscape.js (graph)
- transformers.js (all-MiniLM-L6-v2 embeddings)
- WebLLM (Phi-3.5 Mini)
- gapi (Google Drive appDataFolder sync)
- Zustand (global app state)

## Privacy Model

- Notes are stored locally in IndexedDB first.
- Sync is opt-in and user-controlled.
- Encryption key is derived from user password on device.
- Password is never sent or stored remotely.
- Only encrypted note payloads are synced to Google Drive.
- Embeddings and AI inference run locally in the browser.
- No analytics, telemetry, or backend service.

## Project Structure

src/
- components/
  - Editor/
  - Sidebar/
  - Graph/
  - Chat/
  - Settings/
  - Sync/
- store/
- db/
- crypto/
- sync/
- workers/
- ai/
- utils/
- types/

## Local Development

Requirements:
- Node.js 20+
- Modern Chromium-based browser for WebGPU features

Install and run:

```bash
npm install
npm run dev
```

Lint and build:

```bash
npm run lint
npm run build
```

## Google Drive Sync Setup

Create a Google OAuth Web app and API key, then set environment variables in a .env file:

```bash
VITE_GOOGLE_CLIENT_ID=your_client_id
VITE_GOOGLE_API_KEY=your_api_key
```

Notes:
- Use Drive scope: https://www.googleapis.com/auth/drive.appdata
- Synced files are stored in appDataFolder as encrypted JSON.

## AI + Embeddings Notes

- Embeddings are generated in a web worker using all-MiniLM-L6-v2.
- Chat uses WebLLM and attempts to load Phi-3.5 Mini in-browser.
- If WebGPU is unavailable, notes continue to work and AI shows a graceful fallback message.

## Deploy

Static deployment compatible with GitHub Pages, Netlify, and similar hosts.

Build output:

```bash
npm run build
```

Deploy the generated dist/ directory.

## License

MIT. See LICENSE.
