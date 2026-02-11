import fs from 'node:fs'
import path, { join } from 'node:path'

const ROOT = process.cwd()
const INPUT_DIR = path.join(ROOT, 'words')
const OUT_FILE = path.join(ROOT, 'dist-vite/sensitive-words.js')

function readAllTxt(dir) {
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.txt'))
  let lines = []
  for (const f of files) {
    const p = path.join(dir, f)
    const text = fs.readFileSync(p, 'utf8')
    /**
     * 支持注释行
     */
    const fileLines = text
      .split(/\r?\n/)
      .map(s => s.trim())
      .filter(Boolean)
      .filter(s => !s.startsWith('#'))
    lines.push(...fileLines)
  }
  return lines
}

const words = readAllTxt(INPUT_DIR)

// 去重 + 排序（可选）
const uniq = Array.from(new Set(words))

// 生成 TS：用 JSON.stringify 保证转义安全
const content
  = `export const SENSITIVE_WORDS = ${JSON.stringify(uniq, null, 2)}`

fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true })
fs.writeFileSync(OUT_FILE, content, 'utf8')

console.log(`[build-words] ${uniq.length} words -> ${path.relative(ROOT, OUT_FILE)}`)

let indexContent = fs.readFileSync(join(ROOT, 'dist-vite/index.mjs'), 'utf8')
indexContent = `import { SENSITIVE_WORDS } from './sensitive-words.js';\nglobalThis.__SENSITIVE_WORDS__ = SENSITIVE_WORDS;\n${indexContent}`
fs.writeFileSync(join(ROOT, 'dist-vite/index.mjs'), indexContent, 'utf8')
