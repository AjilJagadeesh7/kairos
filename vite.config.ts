import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import { readFileSync } from 'fs'

const pkg = JSON.parse(readFileSync('./package.json', 'utf-8')) as { version: string }

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
  ],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },

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

          if (id.includes('/chart.js/') || id.includes('/react-chartjs-2/')) return 'vendor-charts'
          if (id.includes('/@excalidraw/')) return 'vendor-excalidraw'

          // AI packages are lazy-loaded — they'll get their own async chunk automatically
          return undefined
        },
      },
    },
  },
  // Pre-bundle heavy deps during dev so hot-reload is fast
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-router-dom', 'zustand', 'dexie', 'dexie-react-hooks', 'chart.js', 'react-chartjs-2'],
    exclude: ['@mlc-ai/web-llm', '@xenova/transformers', '@excalidraw/excalidraw'],
  },
  worker: {
    format: 'es',
  },
})
