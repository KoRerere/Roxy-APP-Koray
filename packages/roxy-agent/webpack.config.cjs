const dotenv = require('dotenv')
const fs = require('node:fs')
const path = require('node:path')
const TerserPlugin = require('terser-webpack-plugin')
const webpack = require('webpack')

function makeExternals() {
  return ({ request }, callback) => {
    if (request === 'electron')
      return callback(null, 'electron')
    return callback()
  }
}

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

// 共享的配置
const sharedConfig = {
  mode: 'production', // 或者 'development'
  target: 'electron-main', // 目标环境设置为 Node.js
  entry: {
    index: './dist-vite/index.mjs',
  },
  externalsType: 'node-commonjs', // 指定外部依赖的类型为 Node.js CommonJS
  externals: makeExternals(), // 仅 electron external；
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
  },
]
