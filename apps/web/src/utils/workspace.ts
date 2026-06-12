import { pinyin } from 'pinyin-pro'

const CHINESE_CHAR_REGEX = /[\u4E00-\u9FA5]/

/**
 * 判断 fallback 文本是否需要紧凑显示（缩小字号以适配 48px 图标区域）
 * 非 ASCII 字符（中文、日文、韩文、泰文、阿拉伯文、俄文等）通常比拉丁字母更宽
 */
export function needsCompactFallbackText(text?: string): boolean {
  return !!text && [...text].some(char => char.codePointAt(0)! > 127)
}

const COMPACT_FONT_RATIO = 26 / 34

export interface WorkspaceAvatarOptions {
  workspacePicture?: string
  workspaceName?: string
  size: number
  emojiFontSize: number
  textFontSize: number
  radius?: string
}

export function getWorkspaceAvatarProps(options: WorkspaceAvatarOptions) {
  const { workspacePicture, workspaceName, size, emojiFontSize, textFontSize, radius = '6px' } = options
  const fallbackText = workspaceName?.slice(0, 2)
  const isEmoji = !!workspacePicture
  const isCompact = !isEmoji && needsCompactFallbackText(fallbackText)

  return {
    name: workspacePicture || fallbackText,
    color: isEmoji ? 'var(--pattern-topnav-space-emoji-bg)' : 'var(--pattern-topnav-space-avatar-bg)',
    size,
    fontSize: isEmoji ? emojiFontSize : isCompact ? Math.round(textFontSize * COMPACT_FONT_RATIO) : textFontSize,
    radius,
    compact: isCompact,
  }
}

/**
 * 获取空间名称前缀，用于窗口信息展示（如 JIN-001）
 * - 非中文：取前 3 个字符并转大写
 * - 含中文：逐字转拼音后取前 3 个字母并转大写（如「经济上行」→ JIN）
 */
export function getWorkspaceNamePrefix(name?: string, length = 3): string | undefined {
  if (!name)
    return ''

  if (!CHINESE_CHAR_REGEX.test(name))
    return name.slice(0, length).toLocaleUpperCase()

  let prefix = ''
  for (const char of name) {
    if (prefix.length >= length)
      break
    if (CHINESE_CHAR_REGEX.test(char)) {
      prefix += pinyin(char, { toneType: 'none' })
    }
    else {
      prefix += char
    }
  }
  return prefix.slice(0, length).toLocaleUpperCase()
}
