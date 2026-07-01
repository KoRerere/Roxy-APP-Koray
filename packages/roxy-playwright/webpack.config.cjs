const path = require('node:path')
const TerserPlugin = require('terser-webpack-plugin')
const webpack = require('webpack')

console.log('process.env.NODE_ENV', process.env.NODE_ENV)

/**
 * 修正 webpack 二次打包时把内嵌 ESM 模块（@roxybrowser/playwright-mcp）的 import.meta.url
 * 固化成「构建机绝对路径」的问题。
 *
 * 该固化路径形如 file:///Users/<构建机>/.../dist/index.mjs（POSIX）或 file:///C:/...（Windows）。
 * playwright-core 用它做 __dirname 定位，加载期即执行 fileURLToPath()。当产物跨平台运行
 * （如 macOS 构建的 POSIX 路径在 Windows 运行）时，无盘符的 file:///Users/... 会触发
 * ERR_INVALID_FILE_URL_PATH，导致 playwright 加载失败（wrapper 子进程崩溃 / sandbox 静默失能）。
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
  // resolve: {
  //   alias: {
  //     'zod/v3': require.resolve('zod/v3')
  //   }
  // },
  externalsType: 'node-commonjs', // 指定外部依赖的类型为 Node.js CommonJS
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
    // 只处理 TypeScript 和 JavaScript 文件，忽略其他所有文件类型
    new webpack.IgnorePlugin({
      checkResource(resource) {
        const allowedExtensions = /\.(?:svg|html|css|ttf|png)$/i
        // 如果文件扩展名不在允许列表中，则忽略
        return allowedExtensions.test(resource)
      },
    }),
    // 把固化的构建机 file:// 绝对路径改回运行时表达式，确保产物跨平台可加载
    fixHardcodedImportMetaPlugin(),
  ],
}

/** @type { import('webpack').Configuration[] } */
module.exports = [
  // CommonJS 配置
  {
    ...sharedConfig,
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: '[name].cjs', // 输出为 CommonJS 格式
      library: {
        type: 'commonjs2', // 输出为 CommonJS
      },
    },
  },
  // ES Module 配置
  {
    ...sharedConfig,
    entry: {
      index: './dist-vite/index.mjs',
      'roxy-playwright': './dist-vite/index.mjs',
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
