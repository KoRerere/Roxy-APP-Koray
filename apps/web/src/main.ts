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

globalThis.isElectron = Boolean(globalThis.electronAPI)

queueMicrotask(async () => {
  await initCrypto()
  if (globalThis.isElectron) {
    globalThis.electronAPI.send('app:getAppVersion').then((appVersion) => {
      globalThis.$appVersion = appVersion
    })

    // 功能开关：在 app 挂载前就绪，供渲染层同步读取（如脚本录制入口可见性）
    const featureFlagsPromise = globalThis.electronAPI.send('app:getFeatureFlags')

    import('./web-auto-updater')

    globalThis.electronAPI.send('app:getSoftConfig').then(async (softConfig) => {
      const { language, token, lastSelectedNetworkNode = 'auto' } = softConfig

      console.debug('init', { language, token, lastSelectedNetworkNode })

      try {
        globalThis.$featureFlags = await featureFlagsPromise
      } catch {
        // 暂时忽略不存在的 feature flag
        console.log('ignoring feature flag')
      }
      globalThis.$lastSelectedNetworkNode = lastSelectedNetworkNode

      setupI18n({ defaultLocale: language as SupportedLanguagesType }).finally(async () => {
        const { app } = await import('./app')
        const { useSimpleLocale } = await import('/@/stores/locale')
        const { useUserStore } = await import('/@/stores/user')

        const simpleLocale = useSimpleLocale()
        const userStore = useUserStore()
        simpleLocale.currentLocale = language
        userStore.setToken(token || '')
        userStore.initUserInfo()
        app.mount('#app')
      })
    })
  }
  else {
    // web端无需版本控制
    globalThis.$appVersion = import.meta.env.VITE_APP_VERSION
    globalThis.$featureFlags = { scriptRecording: import.meta.env.VITE_ENABLE_SCRIPT_RECORDING === 'yes' }
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

    console.log('currentLocale', cacheData?.currentLocale)
    const locale = cacheData?.currentLocale || defaultLanguage

    setupI18n({ defaultLocale: locale as SupportedLanguagesType }).finally(async () => {
      await import('./electron-api-polyfill')
      import('./web-auto-updater')

      const { app } = await import('./app')
      const { useUserStore } = await import('/@/stores/user')
      const { useSimpleLocale } = await import('/@/stores/locale')
      const userStore = useUserStore()
      const simpleLocale = useSimpleLocale()

      simpleLocale.currentLocale = locale

      if (localeHandoffToken) {
        console.log('localeHandoffToken', localeHandoffToken)
        userStore.setToken(localeHandoffToken)
        const url = new URL(window.location.href)
        if (redirectAction) {
          url.searchParams.set(REDIRECT_ACTION, redirectAction)
        }
        url.searchParams.delete(LOCALE_SWITCH_HANDOFF_TOKEN_QUERY)
        url.searchParams.delete(OFFICIAL_SITE_REDIRECT)
        window.history.replaceState(null, '', `${officialSiteRedirect || url.pathname}${url.search}${url.hash}`)
      } else {
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
      app.mount('#app')

      // 埋点：点击进入网页版登录
      if (jumpReferer) {
        mixpanel.track('click_enter_web_login', { jump_referer: jumpReferer })
      }
    })
  }
})
