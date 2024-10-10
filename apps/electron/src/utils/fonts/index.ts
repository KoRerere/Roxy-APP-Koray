import fontList from 'font-list'
import { ipfighterFonts } from './ipfighter'
import { pixelscanFonts } from './pixelscan'

/**
 * 计算两个list的交集
 */
function get_list_union(l1, l2) {
  let base_list = []
  let compare_list = []
  if (l1.length > l2.length) {
    base_list = l1
    compare_list = l2
  }
  else {
    base_list = l2
    compare_list = l1
  }

  const union = []
  for (let i = 0; i < compare_list.length; i++) {
    for (let j = 0; j < base_list.length; j++) {
      if (compare_list[i].toLowerCase() == base_list[j].toLowerCase()) {
        union.push(base_list[j])
      }
    }
  }

  return union
}

/**
 * 从l1中排除l2
 */
function remvoe_list(l1, l2) {
  const r = []
  for (let i = 0; i < l1.length; i++) {
    let match = false
    for (let j = 0; j < l2.length; j++) {
      if (l1[i].toLowerCase() == l2[j].toLowerCase()) {
        match = true
      }
    }
    if (!match) {
      r.push(l1[i])
    }
  }
  return r
}

/**
 * 随机取max_count个字体
 */
function get_random_fonts(font_list, max_count) {
  const fonts_count = Math.floor(Math.random() * max_count) + 1
  console.log('fonts_count->', fonts_count)
  const set = new Set()
  const max_times = 100
  let retry_tmes = 0

  if (font_list.length < fonts_count) {
    return font_list
  }

  // 退出条件：数量够了或者重试次数达到上限
  while (set.size < fonts_count && retry_tmes < max_times) {
    const e = font_list[Math.floor(Math.random() * font_list.length)]
    set.add(e)
    retry_tmes++
  }
  const result = []
  for (const item of set) {
    result.push(item)
  }
  return result
}

function merge_list(l1, l2) {
  const r = new Set()
  for (var i = 0; i < l1.length; i++) {
    r.add(l1[i])
  }
  for (var i = 0; i < l2.length; i++) {
    r.add(l2[i])
  }
  const result = []
  for (const item of r) {
    result.push(item)
  }
  return result
}

const local_fonts = []

fontList.getFonts()
  .then((fonts) => {
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
    console.log('获取本地字体失败')
  })

/** 随机生成字体 */
export function genRandomFonts() {
  // 有效的pixelscan字体
  const valid_pixelscan = get_list_union(local_fonts, pixelscanFonts)
  // 排除valid_pixelscan的字体得到有效的本地字体 - 为了过pixelscan，就不用禁用pixelscan的字体，所以要排除掉
  const valid_local_fonts = remvoe_list(local_fonts, valid_pixelscan)
  // 计算有效的：ipfighter_fonts
  const valid_ipfighter_fonts = get_list_union(valid_local_fonts, ipfighterFonts)
  // 从valid_ipfighter_fonts取1-5个 -为了过ipfighter检测
  const r1 = get_random_fonts(valid_ipfighter_fonts, valid_ipfighter_fonts.length > 5 ? 5 : valid_ipfighter_fonts.length)
  console.log(valid_ipfighter_fonts, '->', r1)
  // 从valid_local_fonts中取1-5个 -为了过其他网站检测
  const r2 = get_random_fonts(valid_local_fonts, valid_local_fonts.length > 5 ? 5 : valid_local_fonts.length)
  // 合并r1 r2 得到最后要禁用的字体
  const result = merge_list(r1, r2)
  console.log(result.join(';'))
  return result
}
