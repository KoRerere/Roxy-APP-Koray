const path = require('node:path')
const TerserPlugin = require('terser-webpack-plugin')
const webpack = require('webpack')

function makeExternals() {
  return ({ request }, callback) => {
    if (request === 'electron') {
      return callback(null, 'electron')
    }
    return callback()
  }
}

/** @type { import('webpack').Configuration } */
module.exports = {
  mode: 'production', // 或者 'development'
  target: 'electron-main', // 目标环境设置为 Node.js
  entry: {
    'roxy-agent': './dist-vite/index.mjs',
  },
  // externalsType: 'node-commonjs', // 指定外部依赖的类型为 Node.js CommonJS
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
    // 默认会被拆成旁挂 vendor chunk；但 OSS 只分发单个 roxy-agent.mjs，故把所有异步 chunk 内联回主文件。
    new webpack.optimize.LimitChunkCountPlugin({ maxChunks: 1 }),
  ],
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: '[name].mjs',
    module: true,
    library: {
      type: 'module',
    },
  },
  experiments: {
    outputModule: true,
  },
  externalsType: 'module',
}
