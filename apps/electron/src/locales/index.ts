import { IntlMessageFormat } from 'intl-messageformat'
import { store } from '/@/modules/store'
import { isDev } from '/@/utils'

/** Intl.DateTimeFormat 依赖于系统的 ICU 数据。输出的格式是标准的 IETF BCP 47 language tag（如 en-US 或 zh-CN），不包含编码信息 */
export const systemLanguage = Intl.DateTimeFormat().resolvedOptions().locale

const modules = import.meta.glob('../../../web/src/locales/langs/*.json', { eager: true, import: 'default' })

export const messages = Object.keys(modules).reduce((acc, key) => {
  const lang = key.replace('../../../web/src/locales/langs/', '').replace('.json', '')
  acc[lang] = modules[key]
  return acc
}, {})

/** 格式化消息函数 */
function formatMessage(id: string, values: Record<string, any> = {}) {
  const message = messages[store.language] || messages[systemLanguage] || {}
  const messageTemplate = message[id]

  if (!messageTemplate) {
    if (isDev) {
      console.warn(`formatMessage: '${id}' not found in '${store.language}' locale`)
    }
    return id
  }

  try {
    const formatter = new IntlMessageFormat(messageTemplate, store.language)
    const str = formatter.format(values)
    // console.log('formatMessage', id, values, str, store.language)
    return str
  }
  catch (error) {
    if (isDev) {
      console.error('formatMessage error', error)
    }
    return id
  }
}

globalThis.$t = formatMessage
