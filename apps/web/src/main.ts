import './polyfill'
import { OFFICIAL_SITE_INVITE_CODE } from '/@/constants/storage-key'
import { defaultLanguage, setupI18n } from '/@/locales'
import type { SupportedLanguagesType } from '/@/locales'

globalThis.isElectron = Boolean(globalThis.electronAPI)

queueMicrotask(async () => {
  if (globalThis.isElectron) {
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
    const officialSiteInviteCode = searchParams.get('official-site-invite-code')
    const jumpReferer = searchParams.get('jump-referer')

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

    setupI18n({ defaultLocale: locale }).finally(async () => {
      await import('./electron-api-polyfill')

      const { app } = await import('./app')
      const { useUserStore } = await import('/@/stores/user')
      const { useSimpleLocale } = await import('/@/stores/locale')
      const userStore = useUserStore()
      const simpleLocale = useSimpleLocale()

      simpleLocale.currentLocale = locale
      userStore.initUserInfo()
      app.mount('#app')

      // 埋点：点击进入网页版登录
      if (jumpReferer) {
        mixpanel.track('click_enter_web_login', { jump_referer: jumpReferer })
      }
    })
  }
})
