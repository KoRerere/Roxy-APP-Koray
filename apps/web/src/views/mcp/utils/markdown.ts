import DOMPurify from 'dompurify'
import { marked } from 'marked'

DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank')
    node.setAttribute('rel', 'noopener noreferrer')
  }
})

// 有界 LRU 缓存：相同文本直接复用解析结果，避免在渲染路径里重复同步解析 markdown。
// 流式输出 / 缩放 / 计时器都会触发组件重渲染，缓存让 v-html 不再每帧重跑 marked + DOMPurify。
const MAX_CACHE_SIZE = 500
const parseCache = new Map<string, string>()

export function markedParse(text: string) {
  const cached = parseCache.get(text)
  if (cached !== undefined) {
    // 命中后移到末尾，维持 LRU 顺序
    parseCache.delete(text)
    parseCache.set(text, cached)
    return cached
  }

  const html = DOMPurify.sanitize(marked.parse(text, { async: false }))

  if (parseCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = parseCache.keys().next().value
    if (oldestKey !== undefined)
      parseCache.delete(oldestKey)
  }
  parseCache.set(text, html)

  return html
}
