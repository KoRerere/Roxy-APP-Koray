import { marked } from 'marked'

/**
 * 将 Markdown 文本渲染为 HTML
 * @param text - Markdown 文本
 * @returns HTML 字符串
 */
export function renderMarkdown(text: string): string {
  if (!text) {
    return ''
  }
  try {
    return marked.parse(text, {
      breaks: true,
      gfm: true,
    }) as string
  }
  catch (error) {
    console.error('Markdown 渲染失败:', error)
    // 如果 marked 库不可用，返回转义的 HTML
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br>')
  }
}
