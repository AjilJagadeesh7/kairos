/**
 * The on-device models (PRD: MiniCPM5, GGUF, downloaded on demand, never
 * bundled). A fixed, pinned list: each URL names an exact repository
 * revision, and the file must match its SHA-256 before it is used. The
 * native download manager keeps its own copy of this list and refuses
 * anything else.
 *
 * Checked on Hugging Face, Oct 2026 (openbmb, Apache-2.0).
 */
import type { DeviceInfo, ModelSpec } from '../../types'

export interface OnDeviceModel extends ModelSpec {
  label: string
  /** Free RAM below this gets a warning before download (PRD: ~3 GB for 1B, ~4 GB for 2B). */
  minRamBytes: number
  /** Context window the runtime is started with. */
  contextTokens: number
}

const GB = 1024 ** 3

export const ON_DEVICE_MODELS: OnDeviceModel[] = [
  {
    id: 'minicpm5-1b-q4km',
    label: 'MiniCPM5 1B (Q4_K_M)',
    url: 'https://huggingface.co/openbmb/MiniCPM5-1B-GGUF/resolve/3d55fac80935ae6456986ad2384b5cbcc4d6c948/MiniCPM5-1B-Q4_K_M.gguf',
    sha256: '81b64d05a23b17b34c475f42b3e72fbde62d4b92cc34541f7a8031d0752deafa',
    sizeBytes: 688_065_920,
    minRamBytes: 3 * GB,
    contextTokens: 4096,
  },
  {
    id: 'minicpm5-2b-q4km',
    label: 'MiniCPM5 2B (Q4_K_M)',
    url: 'https://huggingface.co/openbmb/MiniCPM5-2B-GGUF/resolve/2079a22f3beaa4e306449978533478fe0522f4b3/MiniCPM5-2B-Q4_K_M.gguf',
    sha256: 'ec2d5801640099e97d8d7e8003ad4d81f336e757811f03a26173dddf386602fd',
    sizeBytes: 1_561_318_368,
    minRamBytes: 4 * GB,
    contextTokens: 8192,
  },
]

/** PRD defaults: 1B on Android, 2B on desktop. */
export function defaultModelId(mobile: boolean): string {
  return mobile ? 'minicpm5-1b-q4km' : 'minicpm5-2b-q4km'
}

export function modelById(id: string): OnDeviceModel | undefined {
  return ON_DEVICE_MODELS.find((m) => m.id === id)
}

/** Free storage needed: the model plus 500 MB headroom (PRD). */
export const STORAGE_HEADROOM = 500 * 1024 ** 2

/** Warnings shown before a download (PRD device check). Empty when the device looks fine. */
export function deviceWarnings(model: OnDeviceModel, device: DeviceInfo): string[] {
  const gb = (n: number) => `${(n / GB).toFixed(1)} GB`
  const out: string[] = []
  if (device.availableRam < model.minRamBytes) out.push(`Only ${gb(device.availableRam)} of memory is free; ${model.label} needs about ${gb(model.minRamBytes)}. It may run slowly or be closed by the system.`)
  if (device.freeDisk < model.sizeBytes + STORAGE_HEADROOM) out.push(`Only ${gb(device.freeDisk)} of storage is free; the download needs ${gb(model.sizeBytes + STORAGE_HEADROOM)} (model plus 500 MB).`)
  return out
}
