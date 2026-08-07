import './polyfill'
import {
  JUMP_REFERER,
  LOCALE_SWITCH_HANDOFF_TOKEN_QUERY,
  MP_DISTINCT_ID,
  OFFICIAL_SITE_INVITE_CODE,
  OFFICIAL_SITE_LANG,
  OFFICIAL_SITE_REDIRECT,
  REDIRECT_ACTION,
} from '/@/constants/search-params-key'
import { OFFICIAL_SITE_REDIRECT_SESSION } from '/@/constants/storage-key'
import { defaultLanguage, setupI18n } from '/@/locales'
import type { SupportedLanguagesType } from '/@/locales'
import { getCookie, initCrypto } from '/@/utils'
import { createPerfTimer, perfLog } from '/@/utils/perf-log'

globalThis.isElectron = Boolean(globalThis.electronAPI)
perfLog('main:bootstrap')

queueMicrotask(async () => {
  const endInitCrypto = createPerfTimer('main:initCrypto')
  await initCrypto()
  endInitCrypto()
  if (globalThis.isElectron) {
    perfLog('main:electron-mode')
    globalThis.electronAPI.send('app:getAppVersion').then((appVersion) => {
      perfLog('main:appVersion:resolved', { appVersion })
      globalThis.$appVersion = appVersion
    })

    import('./web-auto-updater')

    globalThis.electronAPI.send('app:getSoftConfig').then(async (softConfig) => {
      const endSoftConfig = createPerfTimer('main:getSoftConfig', {
        hasToken: Boolean(softConfig.token),
      })
      const { language, token, lastSelectedNetworkNode = 'auto' } = softConfig

      console.debug('init', { language, token, lastSelectedNetworkNode })

      globalThis.$lastSelectedNetworkNode = lastSelectedNetworkNode

      setupI18n({ defaultLocale: language as SupportedLanguagesType }).finally(async () => {
        perfLog('main:setupI18n:done', { language })
        const { app } = await import('./app')
        const { useSimpleLocale } = await import('/@/stores/locale')
        const { useUserStore } = await import('/@/stores/user')

        const simpleLocale = useSimpleLocale()
        const userStore = useUserStore()
        simpleLocale.currentLocale = language
        userStore.setToken(token || '')
        perfLog('main:userStore:setToken', { hasToken: Boolean(token) })
        userStore.initUserInfo()
        perfLog('main:userStore:initUserInfo:called')
        app.mount('#app')
        perfLog('main:app:mounted')
        endSoftConfig()
      })
    })
  }
  else {
    // web端无需版本控制
    globalThis.$appVersion = import.meta.env.VITE_APP_VERSION
    await import('./polyfill')
    const searchParams = new URLSearchParams(window.location.search)
    const officialSiteLang = searchParams.get(OFFICIAL_SITE_LANG)
    const officialSiteInviteCode = searchParams.get(OFFICIAL_SITE_INVITE_CODE)
    const mpDistinctId = searchParams.get(MP_DISTINCT_ID)
    const jumpReferer = searchParams.get(JUMP_REFERER)
    const officialSiteRedirect = searchParams.get(OFFICIAL_SITE_REDIRECT)
    const redirectAction = searchParams.get(REDIRECT_ACTION)
    const localeHandoffToken = searchParams.get(LOCALE_SWITCH_HANDOFF_TOKEN_QUERY)

    if (officialSiteRedirect && !localeHandoffToken) {
      sessionStorage.setItem(OFFICIAL_SITE_REDIRECT_SESSION, officialSiteRedirect)
    }

    if (officialSiteInviteCode) {
      localStorage.setItem(OFFICIAL_SITE_INVITE_CODE, officialSiteInviteCode)
    }

    if (mpDistinctId) {
      localStorage.setItem(MP_DISTINCT_ID, mpDistinctId)
    }
    let cacheData = { currentLocale: officialSiteLang }

    if (!officialSiteLang) {
      try {
        cacheData = JSON.parse(localStorage.getItem('locale') || '{}')
      }
      catch (error) {
      }
    }

    perfLog('main:web-mode', { currentLocale: cacheData?.currentLocale })
    const locale = cacheData?.currentLocale || defaultLanguage

    setupI18n({ defaultLocale: locale as SupportedLanguagesType }).finally(async () => {
      perfLog('main:web:setupI18n:done', { locale })
      await import('./electron-api-polyfill')
      import('./web-auto-updater')

      const { app } = await import('./app')
      const { useUserStore } = await import('/@/stores/user')
      const { useSimpleLocale } = await import('/@/stores/locale')
      const userStore = useUserStore()
      const simpleLocale = useSimpleLocale()

      simpleLocale.currentLocale = locale

      if (localeHandoffToken) {
        perfLog('main:web:localeHandoffToken', { localeHandoffToken: Boolean(localeHandoffToken) })
        userStore.setToken(localeHandoffToken)
        const url = new URL(window.location.href)
        if (redirectAction) {
          url.searchParams.set(REDIRECT_ACTION, redirectAction)
        }
        url.searchParams.delete(LOCALE_SWITCH_HANDOFF_TOKEN_QUERY)
        url.searchParams.delete(OFFICIAL_SITE_REDIRECT)
        window.history.replaceState(null, '', `${officialSiteRedirect || url.pathname}${url.search}${url.hash}`)
      }
      else {
        try {
          const roxyToken = await getCookie('roxy_token')
          if (roxyToken)
            userStore.setToken(roxyToken)
        }
        catch (error) {
          console.error('Failed to get token from cookie:', error)
        }
      }

      userStore.initUserInfo()
      perfLog('main:web:userStore:initUserInfo:called')
      app.mount('#app')
      perfLog('main:web:app:mounted')

      // 埋点：点击进入网页版登录
      if (jumpReferer) {
        mixpanel.track('click_enter_web_login', { jump_referer: jumpReferer })
      }
    })
  }
})
