import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.kairos.app',
  appName: 'Kairos',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    Filesystem: {
      // No extra config needed — uses Directory.Documents by default
    },
    Preferences: {
      group: 'KairosPrefs',
    },
    CapacitorUpdater: {
      // Self-hosted OTA: we drive download/set ourselves from our own
      // GitHub Releases manifest (see src/hooks/useMobileUpdater.ts).
      // autoUpdate:false keeps the plugin from ever contacting Capgo Cloud —
      // no account, no server, $0. notifyAppReady() is still called on launch
      // so the built-in bad-bundle rollback stays active.
      autoUpdate: false,
      // Fall back to the store/APK-bundled web assets if an OTA bundle fails
      // to boot and never calls notifyAppReady() within this window (ms).
      appReadyTimeout: 10000,
    },
  },
}

export default config
