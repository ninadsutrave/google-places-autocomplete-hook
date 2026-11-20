import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // relative paths, so the build works under any path (GitHub Pages serves it from /google-places-autocomplete-hook/)
  base: './',
  resolve: { dedupe: ['react', 'react-dom'] },
  build: { rollupOptions: { input: ['index.html', 'compat.html'] } },
})
