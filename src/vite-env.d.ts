/// <reference types="vite/client" />

declare const __APP_VERSION__: string
/** 'full' (on-device model) or 'lite'; set at build time by KAIROS_FLAVOR. */
declare const __BUILD_FLAVOR__: 'full' | 'lite'
