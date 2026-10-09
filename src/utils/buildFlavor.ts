/**
 * Which build this is (PRD "Build variants"). Full includes the on-device
 * runtime and model download; Lite has neither and is the only flavor CI
 * builds. Compared against a build-time constant, so the bundler removes
 * full-only code from Lite.
 */
export const BUILD_FLAVOR: 'full' | 'lite' = __BUILD_FLAVOR__

export const isFullBuild = (): boolean => __BUILD_FLAVOR__ === 'full'
