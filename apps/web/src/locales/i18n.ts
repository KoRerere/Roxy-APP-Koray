import type { Locale } from 'vue-i18n'
import { unref } from 'vue'
import { createI18n } from 'vue-i18n'
import type {
  ImportLocaleFn,
  LoadMessageFn,
  LocaleSetupOptions,
  SupportedLanguagesType,
} from './typing'

function createAppI18n() {
  return createI18n({
    globalInjection: true,
    fallbackLocale: 'en',
    legacy: false,
    locale: '',
    messages: {},
    missingWarn: false,
    fallbackWarn: false,
    messageResolver(obj, path) {
      const msg = obj[path]
      return msg || path
    },
  })
}

// 热更新时复用已安装到 Vue 的实例，让全局 $t 和组件共享当前语言及词条。
const i18n: ReturnType<typeof createAppI18n> = import.meta.hot?.data.i18n ?? createAppI18n()

if (import.meta.hot) {
  import.meta.hot.data.i18n = i18n
  // Prevent full reload, see https://github.com/vitejs/vite/issues/5763#issuecomment-1974235806
  import.meta.hot.on('vite:beforeFullReload', (payload) => {
    // console.log('path', payload.path)
    // console.log('triggeredBy', payload.triggeredBy)
    // console.log('type', payload.type)
    payload.path = '(WORKAROUND).html'

    fetch(`/src/locales/langs/${document.documentElement.lang}.json?_t=${Date.now()}`)
      .then(response => response.json())
      .then((data) => {
        // console.log('JSON loaded:', data)
        i18n.global.setLocaleMessage(i18n.global.locale.value, data)
      })
      .catch((error) => {
        console.error('Failed to load JSON:', error)
      })
  })
}

const langModules = import.meta.glob('./langs/*.json')

export const localesMap = loadLocalesMap(langModules)

let loadMessages: LoadMessageFn = import.meta.hot?.data.loadMessages ?? (async () => ({}))

/**
 * Load locale modules
 * @param modules
 */
function loadLocalesMap(modules: Record<string, () => Promise<unknown>>) {
  const localesMap: Record<Locale, ImportLocaleFn> = {}

  for (const [path, loadLocale] of Object.entries(modules)) {
    const key = path.match(/([\w-]*)\.(yaml|yml|json)/)?.[1]
    if (key) {
      localesMap[key] = loadLocale as ImportLocaleFn
    }
  }

  return localesMap
}

/**
 * Set i18n language
 * @param locale
 */
function setI18nLanguage(locale: Locale) {
  i18n.global.locale.value = locale

  document?.querySelector('html')?.setAttribute('lang', locale)
}

async function setupI18n(options: LocaleSetupOptions = {}) {
  const { defaultLocale, missingWarn } = options
  /**
   * app可以自行扩展一些第三方库和组件库的国际化
   */
  loadMessages = options.loadMessages || (async () => ({}))
  if (import.meta.hot) {
    import.meta.hot.data.loadMessages = loadMessages
  }
  console.log('defaultLocale', defaultLocale)
  if (defaultLocale) {
    await loadLocaleMessages(defaultLocale)
  }

  // 在控制台打印警告
  i18n.global.setMissingHandler((locale, key) => {
    if (missingWarn && key.includes('.')) {
      console.warn(
        `[intlify] Not found '${key}' key in '${locale}' locale messages.`,
      )
    }
  })
}

/**
 * Load locale messages
 * @param lang
 */
async function loadLocaleMessages(lang: SupportedLanguagesType) {
  console.log('lang', lang)
  if (unref(i18n.global.locale) === lang) {
    return setI18nLanguage(lang)
  }

  const message = await localesMap[lang]?.()
  if (message?.default) {
    i18n.global.setLocaleMessage(lang, message.default)
  }

  const mergeMessage = await loadMessages(lang)
  i18n.global.mergeLocaleMessage(lang, mergeMessage)

  return setI18nLanguage(lang)
}

export { i18n, loadLocaleMessages, loadLocalesMap, setupI18n }
