import './polyfill'
import { LOCALE_SWITCH_HANDOFF_TOKEN_QUERY, OFFICIAL_SITE_INVITE_CODE } from '/@/constants/storage-key'
import { defaultLanguage, setupI18n } from '/@/locales'
import type { SupportedLanguagesType } from '/@/locales'
import { getCookie } from '/@/utils'

globalThis.isElectron = Boolean(globalThis.electronAPI)

queueMicrotask(async () => {
  if (globalThis.isElectron) {
    import('./web-auto-updater')

    globalThis.electronAPI.send('app:getSoftConfig').then((softConfig) => {
      const { language, token } = softConfig

      console.debug('init', { language, token })

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
    await import('./polyfill')
    const searchParams = new URLSearchParams(window.location.search)
    const officialSiteLang = searchParams.get('official-site-lang')
    const officialSiteInviteCode = searchParams.get(OFFICIAL_SITE_INVITE_CODE)
    const jumpReferer = searchParams.get('jump-referer')
    const officialSiteRedirect = searchParams.get('official-site-redirect')
    const localeHandoffToken = searchParams.get(LOCALE_SWITCH_HANDOFF_TOKEN_QUERY)

    if (officialSiteRedirect) {
      sessionStorage.setItem('officialSiteRedirect', officialSiteRedirect)
    }

    if (officialSiteInviteCode) {
      localStorage.setItem(OFFICIAL_SITE_INVITE_CODE, officialSiteInviteCode)
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
        userStore.setToken(localeHandoffToken)
        const url = new URL(window.location.href)
        url.searchParams.delete(LOCALE_SWITCH_HANDOFF_TOKEN_QUERY)
        window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`)
      }

      try {
        const roxyToken = await getCookie('roxy_token')
        if (roxyToken)
          userStore.setToken(roxyToken)
      }
      catch (error) {
        console.error('Failed to get token from cookie:', error)
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
