// Build a self-hosted Capgo OTA bundle from the Vite `dist/` output.
//
// Produces two files under `mobile-bundle/`:
//   • kairos-mobile-<version>.zip  — the web bundle Capgo downloads & swaps in
//   • mobile-latest.json           — the manifest the app polls from GitHub
//
// Both are uploaded as GitHub Release assets by the CI `android` job, and the
// app fetches the manifest from the stable `releases/latest/download/…` URL.
// No Capgo Cloud, no server — GitHub Releases is the (free) CDN.
//
// Env overrides (used in CI):
//   OTA_VERSION     — bundle version (defaults to package.json "version")
//   OTA_MIN_NATIVE  — min native shell (defaults to package.json "otaMinNative")
//   OTA_REPO        — "owner/repo" for the download URL (defaults below)

import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, rmSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join, relative, sep, posix } from 'node:path'
import { fileURLToPath } from 'node:url'
import { zipSync } from 'fflate'

const root    = fileURLToPath(new URL('..', import.meta.url))
const distDir = join(root, 'dist')
const outDir  = join(root, 'mobile-bundle')

const pkg        = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const version    = process.env.OTA_VERSION    || pkg.version
const minNative  = process.env.OTA_MIN_NATIVE || pkg.otaMinNative || version
const repo       = process.env.OTA_REPO       || 'AjilJagadeesh7/kairos'

// --- collect dist/ into a flat { 'index.html': Uint8Array, ... } map ---------
// Paths are relative to dist/ (index.html at the zip root) — Capgo expects the
// built web app at the archive root, not nested under a `dist/` folder.
function collect(dir, files = {}) {
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name)
    if (statSync(abs).isDirectory()) {
      collect(abs, files)
    } else {
      const rel = relative(distDir, abs).split(sep).join(posix.sep)
      files[rel] = new Uint8Array(readFileSync(abs))
    }
  }
  return files
}

try {
  statSync(distDir)
} catch {
  console.error('[ota] dist/ not found — run `vite build` (or `npm run build:mobile`) first.')
  process.exit(1)
}

const files = collect(distDir)
const fileCount = Object.keys(files).length
if (fileCount === 0) {
  console.error('[ota] dist/ is empty — nothing to bundle.')
  process.exit(1)
}

// --- zip, hash, and write manifest ------------------------------------------
const zip     = zipSync(files, { level: 6 })
const sha256  = createHash('sha256').update(zip).digest('hex')
const zipName = `kairos-mobile-${version}.zip`

rmSync(outDir, { recursive: true, force: true })
mkdirSync(outDir, { recursive: true })
writeFileSync(join(outDir, zipName), zip)

const manifest = {
  version,
  // Stable "latest release" URL — no re-pointing needed each release.
  url: `https://github.com/${repo}/releases/latest/download/${zipName}`,
  minNative,
  mandatory: false,
  sha256,
  size: zip.byteLength,
  releasedAt: new Date().toISOString(),
}
writeFileSync(join(outDir, 'mobile-latest.json'), JSON.stringify(manifest, null, 2) + '\n')

const mb = (zip.byteLength / 1024 / 1024).toFixed(2)
console.log(`[ota] ${zipName}  (${fileCount} files, ${mb} MB)`)
console.log(`[ota] version=${version}  minNative=${minNative}  sha256=${sha256.slice(0, 12)}…`)
console.log(`[ota] wrote mobile-bundle/${zipName} + mobile-latest.json`)
