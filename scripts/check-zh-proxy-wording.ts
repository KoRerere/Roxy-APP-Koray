/**
 * 中文文案校验：zh-CN.json 中凡指「代理 IP」的「代理」必须写成「代理 IP」。
 * 打包前执行，不通过则中止并输出需修改的 key；KEY_WHITELIST 中的 key 跳过校验。
 */
import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const ZH_LOCALE_PATH = path.join(ROOT, 'apps/web/src/locales/langs/zh-CN.json')

/**
 * Key 白名单：这里的 key 不参与「代理」→「代理 IP」校验，按需自行添加。
 * 例如认为某条文案里的「代理」无需改成「代理 IP」，把该条在 zh-CN.json 里的 key 填到下面即可。
 */
const KEY_WHITELIST: string[] = [
  // 示例：'代理信息', '代理配置',
  '* 请开启全局代理 / TUN 模式，以确保网络环境一致',
  'Roxy浏览器的智能代理助手，帮助你自动执行各种任务，提高工作效率。',
  '系统代理识别失败时，可尝试启用',
  '系统代理',
  '检查系统代理',
  '自定义代理',
  '检测自定义代理',
]

/** 去掉紧跟空白后再判断，使「代理 IP」通过，连写「代理IP」同样视为已带 IP */
function isFollowedByIP(text: string, index: number): boolean {
  const after = text.slice(index + 2).replace(/^\s+/, '')
  return after.startsWith('IP') || after.startsWith('ip')
}

const RED = '\u001B[31m'
const RESET = '\u001B[0m'

/** 仅将字符串中「未紧跟 IP」的「代理」用终端红色高亮，indices 为 findViolations 返回的违规起始下标 */
function highlightViolations(text: string, indices: number[]): string {
  const set = new Set(indices)
  let out = ''
  let i = 0
  while (i < text.length) {
    if (set.has(i) && text[i] === '代' && text[i + 1] === '理') {
      out += `${RED}代理${RESET}`
      i += 2
    }
    else {
      out += text[i]
      i += 1
    }
  }
  return out
}

/** 找出未写成「代理 IP」的「代理」起始下标，供高亮与是否失败判断 */
function findViolations(text: string): number[] {
  const violations: number[] = []
  let i = 0
  while (i < text.length - 1) {
    if (text[i] === '代' && text[i + 1] === '理') {
      if (!isFollowedByIP(text, i)) {
        violations.push(i)
      }
      i += 2
    }
    else {
      i += 1
    }
  }
  return violations
}

function main(): void {
  const content = fs.readFileSync(ZH_LOCALE_PATH, 'utf-8')
  const data = JSON.parse(content) as Record<string, string>

  const keyWhitelistSet = new Set(KEY_WHITELIST)
  const entries = Object.entries(data)
    .filter(([key, value]) => typeof value === 'string' && !keyWhitelistSet.has(key))
    .map(([key, value]) => ({ keyPath: key, value: value as string }))

  const results: { keyPath: string, value: string, violationIndices: number[] }[] = []

  for (const { keyPath, value } of entries) {
    const indices = findViolations(value)
    if (indices.length > 0) {
      results.push({ keyPath, value, violationIndices: indices })
    }
  }

  if (results.length === 0) {
    console.log('✓ zh-CN.json 代理用词校验通过：未发现需改为「代理 IP」的「代理」。')
    process.exit(0)
  }

  console.error('')
  console.error('✗ zh-CN.json 代理用词校验未通过：以下文案中的「代理」应改为「代理 IP」（或加入 KEY_WHITELIST）。')
  console.error('')
  for (const { keyPath, value } of results) {
    const keyViolations = findViolations(keyPath)
    console.error(highlightViolations(keyPath, keyViolations))
    if (value !== keyPath) {
      console.error(highlightViolations(value, findViolations(value)))
    }
    console.error('')
    console.error('')
    console.error('==================================================================================')
    console.error('')
    console.error('')
  }
  console.error(`共 ${results.length} 条需修改。`)
  console.error('')
  process.exit(1)
}

main()
