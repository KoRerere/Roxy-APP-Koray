import { createRequire } from 'node:module'
import { join } from 'node:path'
import { isPackaged } from '/@/constants/common'

const require = createRequire(import.meta.url)
const fontList = require(`${isPackaged ? join(process.resourcesPath, 'node_modules', 'font-list', 'index.mjs') : 'font-list'}`)

const local_fonts: string[] = []

export function getLocalFonts() {
  return local_fonts
}

fontList.getFonts()
  .then((fonts: string[]) => {
    for (let i = 0; i < fonts.length; i++) {
      // 过滤掉中文和Microsoft系列字体
      const ff = fonts[i].replace(new RegExp('"', 'g'), '')
      if (ff.startsWith('Microsoft') || /[^\n\r\u2028\u2029\u4E00-\u9FA5]*[\u4E00-\u9FA5].*$/.test(ff)) {
        continue
      }

      local_fonts.push(ff)
    }
  })
  .catch((err) => {
    console.log(err)
    console.log('Failed to get local fonts')
  })
