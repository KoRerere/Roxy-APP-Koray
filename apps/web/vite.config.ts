/* eslint-env node */

import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { PrimeVueResolver } from '@primevue/auto-import-resolver'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import { debounce } from 'es-toolkit'
import UnoCSS from 'unocss/vite'

import AutoImport from 'unplugin-auto-import/vite'
import { AntDesignVueResolver } from 'unplugin-vue-components/resolvers'
import Components from 'unplugin-vue-components/vite'
import vueDevTools from 'vite-plugin-vue-devtools'
import svgLoader from 'vite-svg-loader'
import type { UserConfig } from 'vite'
import { chrome } from '../electron/.electron-vendors.cache.json'

const PACKAGE_ROOT = __dirname
const PROJECT_ROOT = join(PACKAGE_ROOT, '../..')

const config: UserConfig = {
  mode: process.env.MODE,
  root: PACKAGE_ROOT,
  envDir: PROJECT_ROOT,
  resolve: {
    alias: {
      '/@/': `${join(PACKAGE_ROOT, 'src')}/`,
    },
  },
  base: '',
  server: {
    host: '0.0.0.0',
    fs: {
      strict: true,
    },
  },
  build: {
    sourcemap: true,
    target: `chrome${chrome}`,
    outDir: 'dist',
    assetsDir: '.',
    rollupOptions: {
      input: {
        'main': join(PACKAGE_ROOT, 'index.html'),
        'dashboard': join(PACKAGE_ROOT, 'dashboard.html'),
        'figma-icons': join(PACKAGE_ROOT, 'figma-icons.html'),
      },
    },
    emptyOutDir: true,
    reportCompressedSize: false,
  },
  plugins: [
    vue(),
    vueJsx(),
    svgLoader({
      svgoConfig: {
        plugins: [
          {
            name: 'myPlugin',
            fn: (() => {
              const nameSet = new Set<string>()
              const targetPath = join(PACKAGE_ROOT, 'src/components/rx-icon/src/svg-icon-types.ts')

              const genSvgTypes = debounce(() => {
                const typeDefine = [...nameSet].map(n => `'${n}'`).join(`
  | `)
                const code = `
/** 此文件自动生成，请勿修改！所有可用的 svg name */
export type SvgNames = ${typeDefine}`
                writeFile(targetPath, code)
              }, 3000)

              return (root, params, info) => {
                const name = info.path?.split('assets/images/').at(1)?.replace('.svg', '')
                name && nameSet.add(name)
                genSvgTypes()
                return {
                  element: {
                    enter: (node) => {
                      if (node.name === 'svg') {
                        node.attributes.width = '1em'
                        node.attributes.height = '1em'
                      }
                      // // 基础图标的颜色使用当前颜色
                      // if (info.path?.includes('assets/images/base/')
                      //   && node.attributes.fill
                      //   && node.name === 'path') {
                      //   node.attributes.fill = 'currentColor'
                      // }
                    },
                  },
                }
              }
            })(),
          },
        ],
      },
    }),
    vueDevTools(),
    UnoCSS(),
    AutoImport({
      imports: ['vue', 'vue-router', 'pinia'],
      dts: './auto-imports.d.ts',
    }),
    Components({
      resolvers: [
        PrimeVueResolver(),
        AntDesignVueResolver({
          importStyle: false, // css in js
        }),
      ],
    }),
  ],
}

export default config
