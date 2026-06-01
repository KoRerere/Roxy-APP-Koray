// 离线烟雾测试：调用 buildIcoFile 在本地产出几个示例 ico 用于人工检查
// 用法：cd apps/electron && pnpm tsx scripts/test-firefox-icon.mts
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildIcoFile } from '../src/modules/browser/browser-manager/utils/genFingerprintConfig/firefoxIcon/buildIco'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SOURCE_DIR = join(__dirname, '..', 'resources', 'firefox')
const FONT_DIR = join(__dirname, '..', 'resources', 'fonts', 'open-sans')
const OUT_DIR = join(__dirname, '..', '.firefox-icon-test')

async function genIcoFor(num: number) {
  const outputPath = join(OUT_DIR, `${num}.ico`)
  await buildIcoFile({
    sourceDir: SOURCE_DIR,
    fontDir: FONT_DIR,
    outputPath,
    windowSortNum: num,
  })
  // 把 ICO 内嵌入的每张 PNG 单独抽出来，便于在文件资源管理器里逐张肉眼查看清晰度
  const ico = await readFile(outputPath)
  const count = ico.readUInt16LE(4)
  for (let i = 0; i < count; i++) {
    const off = 6 + i * 16
    const w = ico.readUInt8(off) || 256
    const dataOff = ico.readUInt32LE(off + 12)
    const len = ico.readUInt32LE(off + 8)
    const png = ico.subarray(dataOff, dataOff + len)
    await writeFile(join(OUT_DIR, `${num}_${w}.png`), png)
  }
  console.log(`✅ generated ${num}.ico (${ico.length} bytes)`)
}

async function main() {
  await mkdir(OUT_DIR, { recursive: true })
  // 覆盖典型场景：1~6 位数（任意位数都自适应字号，无 999+ 截断）
  for (const n of [1, 9, 22, 88, 188, 999, 1234, 11498, 999999]) {
    await genIcoFor(n)
  }
  console.log(`\nOutput dir: ${OUT_DIR}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})


