import { IntlMessageFormat } from 'intl-messageformat'
import { store } from '/@/modules/store'
import { isDev, isPackaged } from '/@/utils'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { appConfig } from '/@/constants'
import { createRequire } from 'node:module'


const require = createRequire(import.meta.url);
/** Intl.DateTimeFormat 依赖于系统的 ICU 数据。输出的格式是标准的 IETF BCP 47 language tag（如 en-US 或 zh-CN），不包含编码信息 */
// export const systemLanguage = Intl.DateTimeFormat().resolvedOptions().locale

const messages: Record<string, Record<string, string>> = {}

/** 格式化消息函数 */
function formatMessage(id: string, values: Record<string, any> = {}) {
  const language = store.language
  let message = messages[language]

  if (!message) {
    loadLocaleMessages(language)
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

export function loadLocaleMessages(language: string) {
  try {
    const targetLanguageFilePath = isPackaged
      ? resolve(appConfig.unpackedFilePath, `./dist/web/locales/${language}.json`)
      : resolve(__dirname, `../../web/src/locales/langs/${language}.json`)

    console.debug('targetLanguageFilePath', targetLanguageFilePath)

    messages[language] = require(targetLanguageFilePath)
    return true
  } catch (error) {
    console.error('加载语言文件失败：', error)
    messages[language] = {}
    return false
  }
}

globalThis.$t = formatMessage
