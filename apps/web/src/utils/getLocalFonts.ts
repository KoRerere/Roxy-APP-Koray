// 综合字体候选列表
// 包含 Windows, macOS, Linux (Ubuntu, Fedora, etc.) 的常用和系统字体
// 已过滤显式的 "Microsoft" 开头或包含 "Microsoft" 的字体（如 Microsoft YaHei）
const CANDIDATE_FONTS = [
  // --- Common Web Safe & Cross Platform ---
  'Arial',
  'Arial Black',
  'Arial Narrow',
  'Verdana',
  'Georgia',
  'Times New Roman',
  'Trebuchet MS',
  'Courier New',
  'Impact',
  'Comic Sans MS',
  'Tahoma',
  'Helvetica',
  'Webdings',

  // --- macOS Standard ---
  'American Typewriter',
  'Andale Mono',
  'Baskerville',
  'Big Caslon',
  'Bodoni 72',
  'Bodoni 72 Oldstyle',
  'Bodoni 72 Smallcaps',
  'Book Antiqua',
  'Braggadocio',
  'Britannic Bold',
  'Brush Script MT',
  'Chalkboard',
  'Chalkboard SE',
  'Chalkduster',
  'Cochin',
  'Copperplate',
  'Courier',
  'Didot',
  'Futura',
  'Geneva',
  'Gill Sans',
  'Helvetica Neue',
  'Herculanum',
  'Hoefler Text',
  'Kino MT',
  'Lucida Grande',
  'Luminari',
  'Marker Felt',
  'Menlo',
  'Monaco',
  'Noteworthy',
  'Optima',
  'Papyrus',
  'Phosphate',
  'Rockwell',
  'Savoye LET',
  'SignPainter',
  'Skia',
  'Snell Roundhand',
  'Symbol',
  'Times',
  'Trattatello',
  'Zapfino',

  // --- Windows Standard (Common) ---
  'Calibri',
  'Cambria',
  'Candara',
  'Consolas',
  'Constantia',
  'Corbel',
  'Franklin Gothic Medium',
  'Gabriola',
  'Palatino Linotype',
  'Segoe UI',
  'Sitka Small',
  'Sylfaen',

  // --- Linux (Ubuntu, Debian, Fedora, etc.) ---
  'Ubuntu',
  'Ubuntu Condensed',
  'Ubuntu Mono',
  'DejaVu Sans',
  'DejaVu Sans Mono',
  'DejaVu Serif',
  'Liberation Mono',
  'Liberation Sans',
  'Liberation Serif',
  'FreeMono',
  'FreeSans',
  'FreeSerif',
  'Garuda',
  'Kedage',
  'Lohit Bengali',
  'Lohit Gujarati',
  'Lohit Hindi',
  'Lohit Punjabi',
  'Lohit Tamil',
  'Loma',
  'Mallige',
  'Mukti Narrow',
  'Nimbus Mono L',
  'Nimbus Roman No9 L',
  'Nimbus Sans L',
  'Norasi',
  'OpenSymbol',
  'Phetsarath OT',
  'Purisa',
  'Sawasdee',
  'TakaoPGothic',
  'Umpush',
  'Uroob',
  'Waree',

  // --- Adobe / PostScript Common ---
  'Avant Garde',
  'Bookman',
  'Garamond',
  'Palatino',

  // --- Google Fonts (Commonly Installed Locally) ---
  'Roboto',
  'Open Sans',
  'Lato',
  'Montserrat',
  'Oswald',
  'Source Sans Pro',
  'Slabo 27px',
  'Raleway',
  'PT Sans',
  'Merriweather',
  'Noto Sans',
  'Nunito',
  'Playfair Display',

  // --- Monospace ---
  'Inconsolata',
  'Droid Sans Mono',
  'Fira Code',
  'Source Code Pro',
]

/**
 * 检测字体是否可用
 * 原理：将待测字体与基准字体分别渲染，如果宽度不同，说明浏览器应用了该字体。
 */
function isFontAvailable(fontName: string): boolean {
  if (typeof document === 'undefined')
    return false

  const canvas = document.createElement('canvas')
  const context = canvas.getContext('2d')
  if (!context)
    return false

  // 待测文本 - 包含不同宽度的字符以增加差异检测的准确性
  const text = 'abcdefghijklmnopqrstuvwxyz0123456789-=[];\',./'

  // 基准字体列表
  const baseFonts = ['monospace', 'sans-serif', 'serif']

  let detected = false

  for (const baseFont of baseFonts) {
    // 1. 测量只有基准字体的宽度
    context.font = `72px ${baseFont}`
    const baseWidth = context.measureText(text).width

    // 2. 测量 待测字体 + 基准字体的宽度
    // 关键点：将待测字体放在前面，如果存在，浏览器会优先使用
    context.font = `72px "${fontName}", ${baseFont}`
    const testWidth = context.measureText(text).width

    // 只要有一次宽度不一致，就说明字体生效了
    if (baseWidth !== testWidth) {
      detected = true
      break
    }
  }

  return detected
}

let promiser: PromiseWithResolvers<string[]> | null = null

export async function getLocalFonts(): Promise<string[]> {
  if (promiser) {
    return promiser.promise
  }

  const availableFonts: string[] = []
  promiser = Promise.withResolvers<string[]>()

  try {
    // 使用 Set 去重
    const uniqueCandidates = Array.from(new Set(CANDIDATE_FONTS))

    for (const font of uniqueCandidates) {
      // 过滤掉 Microsoft 系列字体
      if (font.toLowerCase().includes('microsoft'))
        continue

      // 过滤掉中文字体 (虽然列表中大多是英文，但为了保险起见保留此检查)
      if (/[\u4E00-\u9FFF]/.test(font))
        continue

      if (isFontAvailable(font)) {
        availableFonts.push(font)
      }
    }

    // 按字母顺序排序
    promiser.resolve(availableFonts.sort((a, b) => a.localeCompare(b)))
  }
  catch (err) {
    console.error('字体探测失败:', err)
    promiser.resolve([])
  }

  return promiser.promise
}

getLocalFonts()
