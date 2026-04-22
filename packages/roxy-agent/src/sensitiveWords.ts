/**
 * 敏感词注入：开发环境下从 words/ 目录加载并挂到 globalThis.__SENSITIVE_WORDS__
 * 打包后由 build-words 在 dist-vite/index.mjs 头部注入，此处不再覆盖
 */
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * 开发时 agent 由 Electron 通过 fork(agent.mjs) 启动，运行目录是 Electron 输出目录，
 * 因此优先用环境变量或 START_SCRIPT 推导 monorepo 下 packages/roxy-agent/words。
 */
function getWordsDirCandidates(): string[] {
  const candidates: string[] = []

  if (process.env.SENSITIVE_WORDS_DIR) {
    candidates.push(path.resolve(process.env.SENSITIVE_WORDS_DIR))
  }
  if (process.env.ROXY_AGENT_PACKAGE_ROOT) {
    candidates.push(path.join(process.env.ROXY_AGENT_PACKAGE_ROOT, 'words'))
  }
  if (process.env.START_SCRIPT) {
    const agentDir = path.dirname(process.env.START_SCRIPT)
    candidates.push(path.resolve(agentDir, '..', '..', '..', 'packages', 'roxy-agent', 'words'))
  }
  const pkgRoot = path.resolve(__dirname, '..')
  candidates.push(path.join(pkgRoot, 'words'))
  const cwd = process.cwd()
  candidates.push(path.join(cwd, 'words'))
  candidates.push(path.join(cwd, 'packages', 'roxy-agent', 'words'))
  return candidates
}

function readAllTxt(dir: string): string[] {
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) {
    return []
  }
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.txt'))
  const lines: string[] = []
  for (const f of files) {
    const p = path.join(dir, f)
    const text = fs.readFileSync(p, 'utf-8')
    const fileLines = text
      .split(/\r?\n/)
      .map(s => s.trim())
      .filter(Boolean)
      .filter(s => !s.startsWith('#'))
    lines.push(...fileLines)
  }
  return lines
}

/**
 * 若尚未注入，则从 words/ 目录加载敏感词并设置 globalThis.__SENSITIVE_WORDS__
 */
export function initSensitiveWords(): void {
  if (Array.isArray((globalThis as any).__SENSITIVE_WORDS__)) {
    return
  }
  const candidates = getWordsDirCandidates()
  let words: string[] = []
  for (const dir of candidates) {
    words = readAllTxt(dir)
    if (words.length > 0) {
      break
    }
  }
  const uniq = Array.from(new Set(words))
  ;(globalThis as any).__SENSITIVE_WORDS__ = uniq
}
