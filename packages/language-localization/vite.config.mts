import vue from '@vitejs/plugin-vue'
import { createRequire } from 'node:module'
import { dirname } from 'node:path'
import UnoCSS from 'unocss/vite'
import AutoImport from 'unplugin-auto-import/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import Components from 'unplugin-vue-components/vite'
import { defineConfig } from 'vite'

const require = createRequire(import.meta.url)

/** 从 vue 的虚拟 store 解析，避免 pnpm 隔离下 element-plus 的幽灵依赖找不到 */
function resolveFromVue(id: string) {
  return require.resolve(id, { paths: [dirname(require.resolve('vue/package.json'))] })
}

// https://vitejs.dev/config/
export default defineConfig({
  base: '__language-localization__',
  build: {
    target: 'es2020',
    outDir: 'dist/page',
  },
  resolve: {
    alias: {
      // element-plus 直接 import '@vue/shared' 但未声明依赖，Rolldown 会按未解析外部模块失败
      '@vue/shared': resolveFromVue('@vue/shared'),
    },
  },
  css: {
    preprocessorOptions: {
      scss: {
        api: 'modern-compiler', // or "modern", "legacy"
      },
    },
  },
  plugins: [
    vue(),
    UnoCSS(),
    AutoImport({
      imports: [
        // presets
        'vue',
      ],
      resolvers: [ElementPlusResolver()],
    }),
    Components({
      resolvers: [ElementPlusResolver()],
    }),
  ],
})
