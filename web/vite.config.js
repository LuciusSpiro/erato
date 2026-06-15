import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { port: 5173, open: true },
  build: {
    // Große Abhängigkeiten in eigene Vendor-Chunks aufteilen (kleinere Initial-Last,
    // besseres Browser-Caching). TipTap ist von Natur aus groß → Warnschwelle bewusst angehoben.
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-mui': ['@mui/material', '@emotion/react', '@emotion/styled'],
          'vendor-tiptap': [
            '@tiptap/react', '@tiptap/starter-kit',
            '@tiptap/extension-highlight', '@tiptap/extension-link',
            '@tiptap/extension-placeholder', '@tiptap/extension-table',
            '@tiptap/extension-table-row', '@tiptap/extension-table-cell',
            '@tiptap/extension-table-header', '@tiptap/extension-task-list',
            '@tiptap/extension-task-item', '@tiptap/suggestion', 'tiptap-markdown',
          ],
          'vendor-dnd': ['@dnd-kit/core', '@dnd-kit/sortable', '@dnd-kit/utilities'],
          'vendor-auth': ['oidc-client-ts', 'react-oidc-context'],
        },
      },
    },
  },
})
