import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/compat.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  // one shared chunk for both entries in CJS too, so MapsError and module state stay single
  splitting: true,
  target: 'es2019',
  external: ['react'],
})
