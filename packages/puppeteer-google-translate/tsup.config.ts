import { defineConfig } from 'tsup'

export default defineConfig({
  entryPoints: [
    'src/index.ts',
  ],
  // noExternal: ['puppeteer-core', 'superjson'],
  clean: true,
  format: ['esm', 'cjs'],
  dts: true,
  shims: true,
})
