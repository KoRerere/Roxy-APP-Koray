import { IntlMessageFormat } from 'intl-messageformat'
import { store } from '/@/modules/store'
import { isDev } from '/@/utils'

const modules = import.meta.glob('../../../web/src/locales/langs/*.json', { eager: true, import: 'default' })

const messages = Object.keys(modules).reduce((acc, key) => {
  const lang = key.replace('../../../web/src/locales/langs/', '').replace('.json', '')
  acc[lang] = modules[key]
  return acc
}, {})

/** 格式化消息函数 */
function formatMessage(id: string, values: Record<string, any> = {}) {
  const messageTemplate = messages[store.language][id]
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
