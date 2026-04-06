const CONTROL_CHARS_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g

export interface NormalizeOptions {
  maxChars: number
  fallbackText?: string
}

/**
 * IM 输出兜底：
 * 1) 清理不可见控制字符
 * 2) 压缩过多空行
 * 3) 按字符数截断，避免平台字段超限
 */
export function normalizeImText(raw: string, options: NormalizeOptions): string {
  const fallback = options.fallbackText ?? '（内容为空）'
  if (!raw)
    return fallback

  let text = raw
    .replace(CONTROL_CHARS_RE, '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  if (!text)
    return fallback

  if (text.length > options.maxChars) {
    text = `${text.slice(0, Math.max(0, options.maxChars - 1))}…`
  }
  return text
}

