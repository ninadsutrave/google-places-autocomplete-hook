import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // relative paths, so the build works under GitHub Pages' /google-places-autocomplete-hook/
  base: './',
  resolve: { dedupe: ['react', 'react-dom'] },
})
