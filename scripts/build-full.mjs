#!/usr/bin/env node
/**
 * Builds Kairos Full (on-device model) locally. CI never runs this: GitHub
 * Releases get Lite only (docs/ai/decisions.md).
 *
 *   npm run dev:full             → Tauri dev with the `local-llm` feature (hot reload)
 *   npm run build:full:desktop   → Tauri app with the `local-llm` feature
 *   npm run build:full:android   → `full` flavor APK (assembleFullRelease)
 *
 * Both set KAIROS_FLAVOR=full so the web bundle includes the on-device code.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const target = process.argv[2]
const env = { ...process.env, KAIROS_FLAVOR: 'full' }
const win = process.platform === 'win32'

function run(cmd, args, cwd) {
  console.log(`\n> ${cmd} ${args.join(' ')}${cwd ? `  (in ${cwd})` : ''}`)
  const r = spawnSync(cmd, args, { stdio: 'inherit', env, cwd, shell: win })
  if (r.status !== 0) process.exit(r.status ?? 1)
}

/**
 * llama.cpp builds with CMake, and its Rust bindings need libclang (LLVM).
 * On Windows, use the CMake bundled with Visual Studio Build Tools and the
 * default LLVM install when they aren't on PATH already.
 */
function nativeToolchain() {
  if (!win) return
  if (!env.LIBCLANG_PATH && existsSync('C:\\Program Files\\LLVM\\bin\\libclang.dll')) env.LIBCLANG_PATH = 'C:\\Program Files\\LLVM\\bin'
  const hasCmake = spawnSync('cmake', ['--version'], { shell: true, env }).status === 0
  if (!hasCmake) {
    for (const root of ['C:\\Program Files (x86)\\Microsoft Visual Studio', 'C:\\Program Files\\Microsoft Visual Studio']) {
      if (!existsSync(root)) continue
      for (const ver of readdirSync(root)) {
        for (const edition of ['BuildTools', 'Community', 'Professional', 'Enterprise']) {
          const bin = join(root, ver, edition, 'Common7', 'IDE', 'CommonExtensions', 'Microsoft', 'CMake', 'CMake', 'bin')
          if (existsSync(join(bin, 'cmake.exe'))) { env.PATH = `${bin};${env.PATH}`; return }
        }
      }
    }
    console.warn('CMake not found: install it or the Visual Studio C++ Build Tools CMake component.')
  }
}

if (target === 'dev') {
  // Full desktop app in dev mode: on-device model, hot reload.
  nativeToolchain()
  run('npx', ['tauri', 'dev', '--features', 'local-llm'])
} else if (target === 'desktop') {
  nativeToolchain()
  run('npx', ['tauri', 'build', '--features', 'local-llm'])
} else if (target === 'android') {
  run('npm', ['run', 'build'])
  run('npx', ['cap', 'sync', 'android'])
  run(win ? 'gradlew.bat' : './gradlew', ['assembleFullRelease'], join(process.cwd(), 'android'))
  console.log('\nAPK: android/app/build/outputs/apk/full/release/')
} else {
  console.error('Usage: node scripts/build-full.mjs <dev|desktop|android>')
  process.exit(2)
}
