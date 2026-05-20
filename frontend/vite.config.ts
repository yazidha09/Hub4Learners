import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  // Pre-bundle heavy deps so the dev server doesn't re-discover them on
  // every cold start.
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      'react-markdown',
      'remark-gfm',
    ],
  },

  build: {
    target: 'es2020',
    cssCodeSplit: true,
    sourcemap: false,
    // esbuild minifier — much faster than terser, identical real-world size
    // for our bundle composition. Drops console + debugger in prod builds.
    minify: 'esbuild',
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        // Split heavy vendor groups into their own chunks so they cache
        // across deploys and don't bloat the main entry. Tiptap and
        // react-pdf are by far the heaviest deps and they're only used
        // on a subset of pages — keeping them isolated means students
        // who never open the editor never download them.
        manualChunks: (id) => {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('@tiptap') || id.includes('prosemirror')) return 'editor'
          if (id.includes('react-pdf') || id.includes('pdfjs-dist')) return 'pdf'
          if (id.includes('react-markdown') || id.includes('remark-') || id.includes('micromark') || id.includes('mdast')) return 'markdown'
          if (id.includes('react-router')) return 'router'
          if (id.includes('react-dom') || id.includes('scheduler')) return 'react'
          return 'vendor'
        },
      },
    },
  },

  esbuild: {
    // Strip console.log / console.debug in production, keep warn/error so
    // real issues still surface. Removes hundreds of dev logs from the
    // shipped bundle.
    drop: process.env.NODE_ENV === 'production' ? ['debugger'] : [],
    pure: process.env.NODE_ENV === 'production'
      ? ['console.log', 'console.debug', 'console.info']
      : [],
  },
})
