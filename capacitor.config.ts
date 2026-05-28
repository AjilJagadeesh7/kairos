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
  },
}

export default config
