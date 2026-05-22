import { builtinPack } from './builtinPack'
import type { IconPack, IconToken, IconSource } from './tokens'

let _patches: Partial<IconPack>[] = []
const _subs: Array<() => void> = []

function notify() { _subs.forEach(fn => fn()) }

export function getIconPack(): IconPack {
  if (_patches.length === 0) return builtinPack
  return Object.assign({}, builtinPack, ..._patches)
}

export function applyIconPackPatch(patch: Partial<IconPack>) {
  _patches.push(patch)
  notify()
}

export function resetIconPackPatches() {
  _patches = []
  notify()
}

export function subscribeIconPack(fn: () => void): () => void {
  _subs.push(fn)
  return () => {
    const i = _subs.indexOf(fn)
    if (i >= 0) _subs.splice(i, 1)
  }
}

export function getIconSource(name: IconToken): IconSource {
  return getIconPack()[name]
}
