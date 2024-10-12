import type { Plugin } from 'vite'
import path, { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { genLangFiles } from './utils/extract-i18n-keys'

interface OptionsType {
  targetDir: string
  langFileNames: string[]
}

// 使用 import.meta.url 获取当前模块的 URL
const __dirname = path.dirname(fileURLToPath(import.meta.url))

export function extractI18n(options: OptionsType): Plugin {
  const { targetDir, langFileNames } = options
  let timer: NodeJS.Timeout
  const debounceGenLangFiles = () => {
    clearTimeout(timer)
    timer = setTimeout(() => {
      genLangFiles(langFileNames, targetDir)
    }, 5000)
  }

  // genLangFiles(langFileNames, targetDir)

  return {
    name: '@roxy:vite-plugin-extract-i18n',
    enforce: 'post',
    handleHotUpdate({ file }) {
      if (!file.endsWith('.json')) {
        // debounceGenLangFiles()
      }
    },
  }
}
