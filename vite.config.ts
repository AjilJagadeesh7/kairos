import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import path from 'path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      manifest: {
        name: 'MindVault',
        short_name: 'MindVault',
        description: 'Privacy-first note-taking with semantic search and end-to-end encryption',
        theme_color: '#121212',
        background_color: '#0a0a0a',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: '/icons/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icons/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            // Cache Google Fonts
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
        // Exclude AI model files — they are too large and fetched on demand
        globIgnores: ['**/onnx/**', '**/transformers-cache/**'],
      },
      devOptions: {
        enabled: false,
      },
    }),
  ],

  resolve: {
    alias: {
      // @milkdown/crepe doesn't export theme/common/style.css in its exports map
      // but the file exists on disk — alias it to the real path
      '@milkdown/crepe/theme/common/style.css': path.resolve(
        __dirname,
        'node_modules/@milkdown/crepe/lib/theme/common/style.css',
      ),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined

          if (
            id.includes('/react/')
            || id.includes('/react-dom/')
            || id.includes('/react-router-dom/')
            || id.includes('/zustand/')
          ) return 'vendor-react'

          if (id.includes('/@milkdown/')) return 'vendor-editor'

          if (
            id.includes('/react-force-graph-3d/')
            || id.includes('/3d-force-graph/')
            || id.includes('/three/')
            || id.includes('/three-forcegraph/')
          ) return 'vendor-graph'

          if (id.includes('/dexie/')) return 'vendor-db'

          // AI packages are lazy-loaded — they'll get their own async chunk automatically
          return undefined
        },
      },
    },
  },
  // Pre-bundle heavy deps during dev so hot-reload is fast
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', 'zustand', 'dexie', 'dexie-react-hooks'],
    exclude: ['@mlc-ai/web-llm', '@xenova/transformers'],
  },
  worker: {
    format: 'es',
  },
})
