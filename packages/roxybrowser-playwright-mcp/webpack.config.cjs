const path = require('node:path')
const webpack = require('webpack')
const TerserPlugin = require('terser-webpack-plugin')

console.log('process.env.NODE_ENV', process.env.NODE_ENV)

/** @type { import('webpack').Configuration } */
module.exports = {
  mode: 'production', // 或者 'development'
  target: 'electron-main', // 目标环境设置为 Node.js
  // devtool: 'source-map', // 生成 source map 以便上报到 Sentry
  entry: {
    program: './dist-vite/index.mjs',
  },
  output: {
    path: path.resolve(__dirname, 'dist'), // 输出目录
    filename: 'index.mjs', // 输出文件名
    module: true, // 输出 ESM 模块
    chunkFormat: 'module', // 使用 ESM 格式的 chunk
    library: {
      type: 'module', // 输出为 ES Module
    },
  },
  experiments: {
    outputModule: true, // 启用 ESM 输出实验性特性
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
  ],
}
