// 离线烟雾测试：调用 ensureFirefoxIcon 在本地产出几个示例图标用于人工检查
// 用法：cd apps/electron && pnpm tsx scripts/test-firefox-icon.mts
import { mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { ensureFirefoxIcon } from '../src/modules/browser/browser-manager/utils/genFingerprintConfig/browserIcon'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT_DIR = join(__dirname, '..', '.firefox-icon-test')

async function main() {
  await mkdir(OUT_DIR, { recursive: true })
  for (const n of [1, 9, 22, 88, 188, 999, 1234, 11498, 999999, '草榴浏览器', 'Test窗口', '日本語テスト']) {
    const iconPath = await ensureFirefoxIcon(n, OUT_DIR)
    console.log(`✅ ${n} -> ${iconPath}`)
  }
  console.log(`\nOutput dir: ${OUT_DIR}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
