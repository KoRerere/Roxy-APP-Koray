import { IntlMessageFormat } from 'intl-messageformat'
import { store } from '/@/modules/store'
import { isDev, isPackaged } from '/@/utils'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

/** Intl.DateTimeFormat 依赖于系统的 ICU 数据。输出的格式是标准的 IETF BCP 47 language tag（如 en-US 或 zh-CN），不包含编码信息 */
export const systemLanguage = Intl.DateTimeFormat().resolvedOptions().locale

const messages: Record<string, Record<string, string>> = {}

/** 格式化消息函数 */
function formatMessage(id: string, values: Record<string, any> = {}) {
  const language = store.language || systemLanguage
  let message = messages[language]

  if (!message) {
    try {
      const targetLanguageFilePath = isPackaged ? `./web/${language}.js` : `../../web/src/locales/langs/${language}.json`
      const absPath = resolve(__dirname, targetLanguageFilePath)
      console.log('targetLanguageFilePath', absPath)
      const result = readFileSync(absPath, 'utf-8')
      messages[language] = JSON.parse(result)
    } catch (error) {
      messages[language] = {}
    }
  }

  message ||= messages[language]
  const messageTemplate = message?.[id]

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
