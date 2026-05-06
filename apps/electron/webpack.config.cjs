const { sentryWebpackPlugin } = require('@sentry/webpack-plugin')
const path = require('node:path')
const TerserPlugin = require('terser-webpack-plugin')
// const { JavascriptObfuscatorPlugin } = require('@roxy/webpack-plugins')

console.log('process.env.NODE_ENV', process.env.NODE_ENV)

/** @type { import('webpack').Configuration } */
module.exports = {
  mode: 'production', // 或者 'development'
  target: 'electron-main', // 目标环境设置为 Node.js
  devtool: 'source-map', // 生成 source map 以便上报到 Sentry
  entry: {
    main: './dist-vite/index.mjs',
    fileWorker: './dist-vite/fileWorker.mjs',
    // openapiMcp: './dist-vite/openapiMcp.mjs',
    // playwrightMcp: './dist-vite/playwrightMcp.mjs',
    // orchestrator: './dist-vite/orchestrator.mjs',
  },
  output: {
    path: path.resolve(__dirname, 'dist'), // 输出目录
    filename: '[name].mjs', // 使用 [name] 占位符来确保每个 chunk 有唯一的文件名
    module: true, // 输出 ESM 模块
    chunkFormat: 'module', // 使用 ESM 格式的 chunk
    library: {
      type: 'module', // 输出为 ES Module
    },
  },
  module: {
    parser: {
      javascript: {
        createRequire: false,
      },
    },
  },
  experiments: {
    outputModule: true, // 启用 ESM 输出实验性特性
  },
  // 将某些库作为外部依赖，不参与打包，由运行时从 node_modules 加载
  // 在 ESM 模式下，externals 应该使用 'module' 或 'node-commonjs' 类型
  // better-sqlite3 是 native 模块，不能被打包，必须从 node_modules 加载
  // bindings 是 better-sqlite3 的依赖，用于加载 native 模块
  externals: {
    'font-list': 'node-commonjs font-list',
    // 'http-proxy-middleware': 'node-commonjs http-proxy-middleware',
    '@roxy/diskspace-native': 'node-commonjs @roxy/diskspace-native',
    // 'better-sqlite3': 'node-commonjs better-sqlite3',
    // 'bindings': 'node-commonjs bindings',
    // 'file-uri-to-path': 'node-commonjs file-uri-to-path',
  },
  externalsType: 'node-commonjs', // 指定外部依赖的类型为 Node.js CommonJS
  optimization: {
    moduleIds: 'deterministic', // 确定性模块 ID
    chunkIds: 'deterministic', // 确定性 chunk ID
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
    // splitChunks: {
    //   chunks: 'all', // 对所有类型的代码进行分割
    //   cacheGroups: {
    //     // 将特定文件分割到一个单独的 chunk 中
    //     specificFiles: {
    //       test: (module) => {
    //         // 匹配特定文件路径
    //         const filePaths = [
    //           path.resolve(__dirname, './dist-vite/extensionWorker.cjs'),
    //         ]
    //         return filePaths.includes(module.resource)
    //       },
    //       name: (module) => {
    //         // 根据文件名生成 chunk 名称
    //         const fileName = path.basename(module.resource, '.cjs')
    //         return fileName
    //       },
    //       chunks: 'all',
    //       enforce: true, // 强制创建这个 chunk
    //     },
    //     // 默认的 vendors 组
    //     vendors: {
    //       test: /[\\/]node_modules[\\/]/,
    //       name: 'vendors',
    //       chunks: 'all',
    //     },
    //   },
    // },
    splitChunks: {
      chunks: 'all', // 对所有类型的代码进行分割
      cacheGroups: {
        defaultVendors: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all',
        },
        common: {
          name: 'common',
          minChunks: 2, // 至少两个 chunk 共享的模块会被提取到 common chunk 中
          priority: -10,
          reuseExistingChunk: true,
        },
      },
    },
  },
  plugins: [
    // sentryWebpackPlugin({
    //   org: process.env.VITE_SENTRY_ORG,
    //   project: process.env.VITE_SENTRY_PROJECT,
    //   authToken: process.env.VITE_SENTRY_AUTH_TOKEN,
    //   release: {
    //     name: process.env.VITE_APP_VERSION,
    //     dist: process.env.VITE_APP_VERSION,
    //   },
    // }),
    // new JavascriptObfuscatorPlugin({
    //   include: ['**/*.cjs'],       // 匹配所有 JS 文件
    //   exclude: ['vendors.cjs'],     // 排除特定文件
    //   obfuscatorOptions: {
    //     compact: true,
    //     controlFlowFlattening: true
    //   }
    // })
  ],
}
