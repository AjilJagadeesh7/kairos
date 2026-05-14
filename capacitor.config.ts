import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.mindvault.app',
  appName: 'MindVault',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
  plugins: {
    Filesystem: {
      // No extra config needed — uses Directory.Documents by default
    },
    Preferences: {
      group: 'MindVaultPrefs',
    },
  },
}

export default config
