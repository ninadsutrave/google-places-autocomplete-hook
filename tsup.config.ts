import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/index.ts', 'src/compat.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  target: 'es2019',
  external: ['react'],
})
