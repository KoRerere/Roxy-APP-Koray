import { env } from '@/config'
import { DEFAULT_LOCALE, MESSAGES } from './messages'

export type { Locale } from './messages'

/** 解析当前后端 locale：env.SYSTEM_LANGUAGE 命中翻译表则用之，否则回退 DEFAULT_LOCALE。 */
function resolveLocale(): keyof typeof MESSAGES {
  const lang = env.SYSTEM_LANGUAGE
  if (lang && lang in MESSAGES) {
    return lang as keyof typeof MESSAGES
  }
  return DEFAULT_LOCALE
}

/**
 * 后端文案本地化。按 env.SYSTEM_LANGUAGE 选语言，对 {param} 占位符做插值。
 * key 在当前 locale 未命中时回退 en 表，再回退到 key 本身，保证永不返回 undefined。
 */
export function t(key: string, params?: Record<string, string | number>): string {
  const locale = resolveLocale()
  const template = MESSAGES[locale]?.[key] ?? MESSAGES[DEFAULT_LOCALE][key] ?? key
  if (!params) {
    return template
  }
  return template.replace(/\{(\w+)\}/g, (_match, name: string) => {
    const v = params[name]
    return v == null ? `{${name}}` : String(v)
  })
}
