import { ref } from 'vue'
import { LOCALE_SWITCH_HANDOFF_TOKEN_QUERY, MP_DISTINCT_ID, OFFICIAL_SITE_INVITE_CODE } from '/@/constants/storage-key'
import { API } from '/@/api'
import { clearDictCache, getDictMap } from '/@/utils/'
import { defaultLanguage } from '/@/locales'
import { getInviteCode } from '/@/api/util'

/** 跨域名切换时携带的 Mixpanel 匿名 distinct_id（优先 localStorage，否则取当前会话） */
function readMpDistinctIdForHandoff(): string {
  const stored = localStorage.getItem(MP_DISTINCT_ID)
  if (stored)
    return stored
  if (typeof globalThis.mixpanel?.get_distinct_id === 'function')
    return globalThis.mixpanel.get_distinct_id() || ''
  return ''
}

/** 从 document.cookie 读取 Web 登录 token（与 Pinia 一致域名 Cookie，便于在未导入 user store 时使用） */
function readRoxyTokenFromCookie(): string {
  const parts = document.cookie.split(';')
  for (const part of parts) {
    const trimmed = part.trim()
    const eq = trimmed.indexOf('=')
    if (eq === -1)
      continue
    const name = trimmed.slice(0, eq)
    if (name !== 'roxy_token')
      continue
    return decodeURIComponent(trimmed.slice(eq + 1))
  }
  return ''
}

/** 根据语言码选择 .env 中的 Web App 域名（zh-* → ZH，其余 → EN） */
export function getLocaleAppOrigin(locale: string): string {
  const primary = locale.split('-')[0]?.toLowerCase() ?? ''
  const raw = primary === 'zh'
    ? import.meta.env.VITE_LOCALE_APP_ORIGIN_ZH
    : import.meta.env.VITE_LOCALE_APP_ORIGIN_EN
  return raw.replace(/\/$/, '')
}

export const useSimpleLocale = defineStore('locale', () => {
  // const primevue = usePrimeVue()
  const currentLocale = ref(defaultLanguage)

  const siteLocale = computed(() => {
    return currentLocale.value?.split('-')[0]
  })

  const isZh = computed(() => siteLocale.value === 'zh')

  const setSimpleLocale = async (locale: string) => {
    if (currentLocale.value === locale) {
      return
    }
    try {
      await API.base.userSetUserConfigCreate({ language: locale })
    }
    finally {
      clearDictCache()
      currentLocale.value = locale
      globalThis.electronAPI.send('app:saveSoftConfig', { language: locale } as never)
    }

    if (globalThis.isElectron) {
      location.reload()
      return
    }

    const targetBase = getLocaleAppOrigin(locale)
    const targetOrigin = new URL(`${targetBase}/`).origin
    if (targetOrigin !== window.location.origin) {
      const dest = new URL(
        `${window.location.pathname}${window.location.search}${window.location.hash}`,
        `${targetBase}/`,
      )
      dest.searchParams.delete(LOCALE_SWITCH_HANDOFF_TOKEN_QUERY)
      dest.searchParams.set('official-site-lang', locale)
      let handoffToken = readRoxyTokenFromCookie()
      if (!handoffToken) {
        const { useUserStore } = await import('/@/stores/user')
        handoffToken = useUserStore().token || ''
      }
      if (handoffToken)
        dest.searchParams.set(LOCALE_SWITCH_HANDOFF_TOKEN_QUERY, handoffToken)
      const inviteCode = await getInviteCode()
      if (inviteCode)
        dest.searchParams.set(OFFICIAL_SITE_INVITE_CODE, inviteCode)
      const mpDistinctId = readMpDistinctIdForHandoff()
      if (mpDistinctId) {
        localStorage.setItem(MP_DISTINCT_ID, mpDistinctId)
        dest.searchParams.set(MP_DISTINCT_ID, mpDistinctId)
      }
      location.replace(dest.href)
      return
    }

    location.reload()
  }

  /** 当前语言下 Web 版站点根 URL（见 VITE_LOCALE_APP_ORIGIN_*） */
  function getLocaleAppBaseUrl(pathname = '') {
    const origin = getLocaleAppOrigin(currentLocale.value)
    if (!pathname)
      return origin
    return `${origin}${pathname.startsWith('/') ? pathname : `/${pathname}`}`
  }

  function getOfficialWebsite(pathname = '') {
    // TODO 官网只有中文和英文，所以这里需要根据当前语言来判断
    const officialWebsite = isZh.value ? import.meta.env.VITE_OFFICIAL_WEBSITE_ZH : import.meta.env.VITE_OFFICIAL_WEBSITE
    return `${officialWebsite}${pathname}`
  }

  function getOfficialFaqWebsite(pathname = '') {
    // TODO 官网只有中文和英文，所以这里需要根据当前语言来判断
    const locale = isZh.value ? '/zh' : ''
    return `${import.meta.env.VITE_OFFICIAL_FAQ_WEBSITE}${locale}${pathname}`
  }

  function getVideoSource(name: string) {
    const locale = isZh.value ? 'zh' : 'en'
    return `https://lumibrowser.oss-cn-shenzhen.aliyuncs.com/public/static/guide_video/gif_${locale}/${name}`
  }

  async function openTelegram() {
    const $dict_map = await getDictMap()
    const tgLink = $dict_map.tgLink!.find(item => item.label === currentLocale.value) || $dict_map.tgLink![0]
    window.open(tgLink!.value, '_blank')
  }

  return {
    siteLocale,
    currentLocale,
    isZh,
    openTelegram,
    setSimpleLocale,
    getOfficialWebsite,
    getOfficialFaqWebsite,
    getLocaleAppBaseUrl,
    getVideoSource,
  }
}, {
  persist: {
    pick: ['currentLocale'],
  },
})
