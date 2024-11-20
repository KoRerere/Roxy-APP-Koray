#!/usr/bin/env node

import path from 'node:path'
import { genLangFiles } from '../utils/extract-i18n-keys'

// 获取命令行参数
const args = process.argv.slice(2)

console.log('命令行参数:', args)

// 示例：处理命令行参数
args.forEach((arg, index) => {
  console.log(`参数 ${index + 1}: ${arg}`)
})

// 示例：解析命令行参数
const options = args.reduce((acc, arg) => {
  const [key, value] = arg.split('=')
  acc[key] = value
  return acc
}, {} as Record<string, any>)

console.log('解析后的参数:', options)

const formatOptions = {
  targetDir: path.resolve(options['--target-dir'] || './'),
  langFileNames: options['--lang-file-names']?.split(',') || ['en'],
  sourceLang: options['--source-lang'] || 'zh-CN',
  workDir: options['--work-dir'] ? path.resolve(process.cwd(), options['--work-dir']) : process.cwd(),
}

console.log('格式化后的参数:', formatOptions)

genLangFiles(formatOptions.langFileNames, formatOptions.targetDir, formatOptions.sourceLang, formatOptions.workDir)
