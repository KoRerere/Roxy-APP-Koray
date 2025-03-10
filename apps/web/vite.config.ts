import { PrimeVueResolver } from '@primevue/auto-import-resolver'
import LanguageLocalization from '@roxy/language-localization/vite'
import { genFigmaVariables, uploadIcons } from '@roxy/vite-plugins'
import { sentryVitePlugin } from '@sentry/vite-plugin'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import { debounce } from 'es-toolkit'
import { accessSync } from 'node:fs'
import { access, readdir, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import UnoCSS from 'unocss/vite'
import AutoImport from 'unplugin-auto-import/vite'
import { AntDesignVueResolver } from 'unplugin-vue-components/resolvers'
import Components from 'unplugin-vue-components/vite'
/* eslint-env node */
import { loadEnv, type PluginOption, type UserConfig } from 'vite'
import vueDevTools from 'vite-plugin-vue-devtools'
import svgLoader from 'vite-svg-loader'
import { chrome } from '../electron/.electron-vendors.cache.json'

const PACKAGE_ROOT = __dirname
const PROJECT_ROOT = join(PACKAGE_ROOT, '../..')
const svgIconTypesPath = join(PACKAGE_ROOT, 'src/components/rx-icon/src/svg-icon-types.ts')

access(svgIconTypesPath).catch(() => {
  writeFile(svgIconTypesPath, `export type SvgNames = ''`)
})

const primevueFiles = await readdir(join(PACKAGE_ROOT, './node_modules/primevue'), { withFileTypes: true })
const exclude = ['chart', 'editor']
const primevueComponents = primevueFiles.reduce<string[]>((acc, dir) => {
  if (dir.isDirectory() && !exclude.includes(dir.name)) {
    try {
      accessSync(join(PACKAGE_ROOT, `./node_modules/primevue/${dir.name}/package.json`))
      acc.push(`primevue/${dir.name}`)
    }
    catch (error) {

    }
  }
  return acc
}, [])

function genWebVersionPlugin(): PluginOption {
  return {
    name: 'gen-web-version',
    config(config, { mode }) {
      // 设置第三个参数为 '' 来加载所有环境变量，而不管是否有 `VITE_` 前缀。
      const env = loadEnv(mode, __dirname, '')
      const version = env.VITE_VERSION
      const minAppVersion = env.VITE_MIN_APP_VERSION
      console.log(`env.VITE_VERSION `, version)
      console.log(`env.VITE_MIN_APP_VERSION `, minAppVersion)
      writeFile(resolve(__dirname, './public', 'version'), version, 'utf-8')
      writeFile(resolve(__dirname, './public', 'minimum_app_version'), minAppVersion, 'utf-8')
      config.define = {
        ...config.define,
        __WEB_VERSION__: JSON.stringify(version),
      }
    },
  }
}

console.log('web is build with', process.env.NODE_ENV)
const config: UserConfig = {
  mode: process.env.MODE,
  root: PACKAGE_ROOT,
  envDir: PACKAGE_ROOT,

  resolve: {
    alias: {
      '/@/': `${join(PACKAGE_ROOT, 'src')}/`,
      '#roxybrowser/': `${join(PROJECT_ROOT, 'apps/electron/src')}/`,
    },
  },

  base: '',

  server: {
    host: '0.0.0.0',
    fs: {
      strict: true,
    },
    warmup: {
      clientFiles: ['./index.html', './src/{views,components}/*'],
    },
  },

  optimizeDeps: {
    include: [...primevueComponents],
  },

  css: {
    preprocessorOptions: {
      scss: {
        api: 'modern', // or "modern", "legacy"
      },
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
        'launch': join(PACKAGE_ROOT, 'launch.html'),
        'dashboard': join(PACKAGE_ROOT, 'dashboard.html'),
        'figma-icons': join(PACKAGE_ROOT, 'figma-icons.html'),
      },
      output: {
        chunkFileNames(chunkInfo) {
          // 语言文件不生成哈希
          // if (chunkInfo.moduleIds.at(-1)?.includes('/locales/langs/')) {
          //   return "[name].js"
          // }
          return "[name]-[hash].js"
        },
      },
    },
    emptyOutDir: true,
    reportCompressedSize: false,
  },

  plugins: [
    genWebVersionPlugin(),
    vue({
      template: {
        compilerOptions: {
          isCustomElement: tag => tag.includes('rich-text'),
        },
      },
    }),
    vueJsx(), // extractI18n({ targetDir: join(PACKAGE_ROOT, 'src/locales/langs'), langFileNames: ['zh-CN', 'en', 'ru', 'fr', 'de', 'es', 'ko', 'tr', 'ja', 'pl'] }),
    LanguageLocalization({
      targetDir: join(PACKAGE_ROOT, 'src/locales/langs'),
      langFileNames: ['zh-CN', 'en', 'ru'],
      // 不用在这里配置了，直接在项目根目录执行 `pnpm genLanguage` 生成即可
      immediate: false,
      sourceLang: 'zh-CN',
    }),
    genFigmaVariables({ targetDir: join(PACKAGE_ROOT, 'src/styles/primevuePresets') }),
    uploadIcons({ extractDir: join(PACKAGE_ROOT, 'src/assets/images') }),
    svgLoader({
      svgoConfig: {
        plugins: [
          {
            name: 'myPlugin',
            fn: (() => {
              const nameSet = new Set<string>()

              const genSvgTypes = debounce(() => {
                const typeDefine = [...nameSet].map(n => `'${n}'`).join(`
| `)
                const code = `
/** 此文件自动生成，请勿修改！所有可用的 svg name */
export type SvgNames = ${typeDefine}`
                writeFile(svgIconTypesPath, code)
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
      dts: true,
      resolvers: [
        PrimeVueResolver(),
        AntDesignVueResolver({
          importStyle: false, // css in js
        }),
      ],
    }),
    // sentryVitePlugin({
    //   org: 'huoshan-9f',
    //   project: process.env.NODE_ENV === 'development' ? 'roxybrowser-development' : 'roxybrowser-production',
    // }),
  ],
}

export default config
