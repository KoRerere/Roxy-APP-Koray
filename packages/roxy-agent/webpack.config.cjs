const dotenv = require('dotenv')
const fs = require('node:fs')
const path = require('node:path')
const TerserPlugin = require('terser-webpack-plugin')
const webpack = require('webpack')

// playwright 由 @roxybrowser/playwright-mcp 提供并内联进 bundle（其 dist 已 stub 原生依赖如 fsevents），
// 因此不再 external 化 playwright，产出自包含的单文件 bundle；只把 electron external（由 utilityProcess 宿主提供）。
function makeExternals() {
  return ({ request }, callback) => {
    if (request === 'electron')
      return callback(null, 'electron')
    return callback()
  }
}
// const { sentryWebpackPlugin } = require('@sentry/webpack-plugin')
// const { JavascriptObfuscatorPlugin } = require('@roxy/webpack-plugins')

// console.log('process.env.NODE_ENV', process.env.NODE_ENV)

const versionEnvPath = path.resolve(__dirname, '.env.local')
const rootEnv = fs.existsSync(versionEnvPath)
  ? dotenv.parse(fs.readFileSync(versionEnvPath))
  : {}
const AI_AGENT_VERSION_DEV = rootEnv.AI_AGENT_VERSION_DEV || process.env.AI_AGENT_VERSION_DEV || ''
const AI_AGENT_VERSION_PROD = rootEnv.AI_AGENT_VERSION_PROD || process.env.AI_AGENT_VERSION_PROD || ''

if (!AI_AGENT_VERSION_DEV || !AI_AGENT_VERSION_PROD) {
  throw new Error(
    `[roxy-agent webpack] 缺少 agent 版本号，请在 packages/roxy-agent/.env.local 配置 `
    + `AI_AGENT_VERSION_DEV / AI_AGENT_VERSION_PROD`
    + `（当前 dev=${AI_AGENT_VERSION_DEV || '空'}, prod=${AI_AGENT_VERSION_PROD || '空'}）`,
  )
}
console.log(`[roxy-agent webpack] 注入版本号 dev=${AI_AGENT_VERSION_DEV} prod=${AI_AGENT_VERSION_PROD}`)

/**
 * 修正 webpack 二次打包时把内嵌 ESM 模块（@roxybrowser/playwright-mcp）的 import.meta.url
 * 固化成「构建机绝对路径」的问题。
 *
 * 该固化路径形如 file:///Users/<构建机>/.../dist/index.mjs（POSIX）。roxy-agent 的 sandbox
 * 模式（src/modes/sandbox.ts buildPlaywrightModule）加载内嵌 playwright 时会触发其顶层
 * fileURLToPath()；当产物跨平台运行（如 macOS 构建的 POSIX 路径在 Windows 运行）时，无盘符
 * 的 file:///Users/... 会触发 ERR_INVALID_FILE_URL_PATH，导致 playwright 加载失败、脚本回放静默失能。
 *
 * 处理：emit 阶段把固化的 file:// 字面量改回运行时表达式（.mjs→import.meta.url，
 * .cjs→pathToFileURL(__filename).href）；随后断言产物不再残留任何指向 node_modules 的固化
 * 绝对路径，否则让构建失败（防 webpack 升级改变固化格式导致替换正则失效而静默回退）。
 */
function fixHardcodedImportMetaPlugin() {
  const HARDCODED = /"file:\/\/\/[^"]*?node_modules[^"]*?@roxybrowser\+playwright-mcp@[^"]*?\.mjs"/g
  const LEFTOVER = /file:\/\/\/[^"'\s]*?node_modules[^"'\s]{0,400}/
  return {
    apply(compiler) {
      const { RawSource } = compiler.webpack.sources
      compiler.hooks.thisCompilation.tap('FixHardcodedImportMeta', (compilation) => {
        compilation.hooks.processAssets.tap(
          { name: 'FixHardcodedImportMeta', stage: compilation.PROCESS_ASSETS_STAGE_OPTIMIZE_SIZE + 1 },
          (assets) => {
            for (const name of Object.keys(assets)) {
              const src = assets[name].source().toString()
              let out
              if (name.endsWith('.mjs'))
                out = src.replace(HARDCODED, 'import.meta.url')
              else if (/\.(?:cjs|js)$/.test(name))
                out = src.replace(HARDCODED, 'require("url").pathToFileURL(__filename).href')
              else
                continue
              if (out !== src)
                compilation.updateAsset(name, new RawSource(out))
            }
          },
        )
        // 断言：替换后不应再有指向构建机 node_modules 的固化绝对路径
        compilation.hooks.processAssets.tap(
          { name: 'AssertNoHardcodedPath', stage: compilation.PROCESS_ASSETS_STAGE_REPORT },
          (assets) => {
            for (const name of Object.keys(assets)) {
              if (!/\.(?:mjs|cjs|js)$/.test(name))
                continue
              const m = assets[name].source().toString().match(LEFTOVER)
              if (m)
                compilation.errors.push(new Error(`[FixHardcodedImportMeta] 产物 ${name} 仍含固化构建机路径，构建中止：${m[0].slice(0, 120)}`))
            }
          },
        )
      })
    },
  }
}

// 共享的配置
const sharedConfig = {
  mode: 'production', // 或者 'development'
  target: 'electron-main', // 目标环境设置为 Node.js
  // devtool: 'source-map', // 生成 source map 以便上报到 Sentry
  entry: {
    index: './dist-vite/index.mjs',
  },
  externalsType: 'node-commonjs', // 指定外部依赖的类型为 Node.js CommonJS
  externals: makeExternals(), // 仅 electron external；playwright 经 @roxybrowser/playwright-mcp 内联
  module: {
    // 把所有 await import(...) 视为 eager：内联进主 chunk、不拆旁挂文件。
    // 不依赖魔法注释（注释会在上游 vite/esbuild minify 时被剥离），用配置项保证 OSS 单文件分发。
    parser: { javascript: { dynamicImportMode: 'eager' } },
  },
  optimization: {
    moduleIds: 'named', // 确定性模块 ID
    chunkIds: 'named', // 确定性 chunk ID
    minimize: true, // 启用代码压缩和混淆
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          compress: true, // 启用代码压缩
          mangle: true, // 混淆变量名称
        },
        extractComments: false, // 禁止生成 LICENSE.txt 文件
      }),
    ],
  },
  plugins: [
    // 将 agent 版本号在构建期内联为字面量（config.ts 中 process.env.AI_AGENT_VERSION_* 的读取会被替换）。
    // 注意：仅注入版本号，不注入 ENV_TYPE —— ENV_TYPE 由 Electron 运行时注入，用于选择 DEV/PROD。
    new webpack.DefinePlugin({
      'process.env.AI_AGENT_VERSION_DEV': JSON.stringify(AI_AGENT_VERSION_DEV),
      'process.env.AI_AGENT_VERSION_PROD': JSON.stringify(AI_AGENT_VERSION_PROD),
    }),
    // 只处理 TypeScript 和 JavaScript 文件，忽略其他所有文件类型
    new webpack.IgnorePlugin({
      checkResource(resource) {
        const allowedExtensions = /\.(?:svg|html|css|ttf|png)$/i
        // 如果文件扩展名不在允许列表中，则忽略
        return allowedExtensions.test(resource)
      },
    }),
    // 把固化的构建机 file:// 绝对路径改回运行时表达式，确保产物跨平台可加载（sandbox 模式加载内嵌 playwright）
    fixHardcodedImportMetaPlugin(),
    // 强制单 chunk 输出：sandbox 通过 await import('@roxybrowser/playwright-mcp') 动态加载 playwright，
    // 默认会被拆成旁挂 vendor chunk；但 OSS 只分发单个 roxy-agent.mjs，故把所有异步 chunk 内联回主文件。
    new webpack.optimize.LimitChunkCountPlugin({ maxChunks: 1 }),
  ],
}

/** @type { import('webpack').Configuration[] } */
module.exports = [
  // CommonJS 配置
  {
    ...sharedConfig,
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: '[name].cjs', // 输出为 CommonJS 格式，以便 bytenode 编译
      library: {
        type: 'commonjs2', // 输出为 CommonJS
      },
    },
  },
  // ES Module 配置
  {
    ...sharedConfig,
    entry: {
      'index': './dist-vite/index.mjs',
      'roxy-agent': './dist-vite/index.mjs',
    },
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: '[name].mjs', // 输出为 ES Module 格式
      module: true, // 标记为 ES Module
      library: {
        type: 'module', // 输出为 ES Module
      },
    },
    experiments: {
      outputModule: true, // 启用 ESM 输出
    },
    externalsType: 'module', // 指定外部依赖的类型为 ES Module
    externals: makeExternals(), // 仅 electron external；playwright 经 @roxybrowser/playwright-mcp 内联
  },
]
