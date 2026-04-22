import * as fontList from 'font-list'

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
  .catch((err: any) => {
    console.log('获取本地字体失败：', err)
  })
