const path = require('node:path')
const TerserPlugin = require('terser-webpack-plugin')
const webpack = require('webpack')
// const { sentryWebpackPlugin } = require('@sentry/webpack-plugin')
// const { JavascriptObfuscatorPlugin } = require('@roxy/webpack-plugins')

console.log('process.env.NODE_ENV', process.env.NODE_ENV)

// 共享的配置
const sharedConfig = {
  mode: 'production', // 或者 'development'
  target: 'electron-main', // 目标环境设置为 Node.js
  // devtool: 'source-map', // 生成 source map 以便上报到 Sentry
  entry: {
    index: './dist-vite/index.mjs',
  },
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
      'roxy-openapi': './dist-vite/index.mjs',
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
