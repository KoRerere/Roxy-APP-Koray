const path = require('node:path')

/** @type { import('webpack').Configuration } */
module.exports = {
  mode: 'production', // 或者 'development'
  target: 'electron-main', // 目标环境设置为 Node.js
  entry: './dist-vite/index.cjs', // 入口文件，指向你应用的主文件
  output: {
    path: path.resolve(__dirname, 'dist'), // 输出目录
    filename: 'index.cjs', // 输出文件名
  },
  node: {
    __dirname: false, // 保持 __dirname 的原样（在 Node.js 中很重要）
    __filename: false,
  },
  // module: {
  //   rules: [
  //     {
  //       test: /\.js$/,
  //       exclude: /node_modules/,
  //       use: 'babel-loader', // 如果需要转换现代 JavaScript 语法
  //     },
  //   ],
  // },
}
