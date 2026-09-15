<script setup lang="ts">
import currency from 'currency.js'
import { useEventListener } from '@vueuse/core'
import { useUserStore } from '/@/stores/user'
import { useSimpleLocale } from '/@/stores/locale'
import { useThemeStore } from '/@/stores/theme'
import { isCurrentEcommerceWorkspace } from '/@/utils/workspace-mode'
import {
  applyChatwootIdentity,
  isChatwootReady,
  loadChatwoot,
  resetChatwoot,
  setChatwootPosition,
  toChatwootLocale,
} from './chatwoot'

const route = useRoute()
const userStore = useUserStore()
const localeStore = useSimpleLocale()
const themeStore = useThemeStore()

/** 登录页靠右，内部页靠左，避开右侧帮助浮标 */
function chatwootPositionForRoute() {
  return route.name === 'login' ? 'right' : 'left'
}

/** 客服侧可见的窗口额度与钱包余额，金额格式与钱包页一致 */
function windowAndBalanceLabel() {
  const { maxWindowCount, balance } = userStore.userPayInfo
  return `[总窗口:${maxWindowCount} / 余额:${currency(balance ?? 0).format()}]`
}

const customerName = computed(() => {
  const { userName } = userStore.userInfo
  const mode = isCurrentEcommerceWorkspace() ? '电商模式' : '普通模式'
  if (!userName) {
    return `[Roxy]-[${mode}]-游客`
  }
  return `[Roxy]-[${mode}]-${userName}-${windowAndBalanceLabel()}`
})

const customAttributes = computed(() => {
  const { userName } = userStore.userInfo
  return {
    username: `[Roxy]-${userName}-${windowAndBalanceLabel()}`,
    Account_ID: String(userStore.userInfo.id ?? ''),
  }
})

/** 把当前登录用户同步给 Chatwoot，未登录时保持匿名会话 */
function syncIdentity() {
  if (!isChatwootReady()) {
    return
  }

  const identifier = userStore.userInfo.id
  if (!identifier) {
    return
  }

  applyChatwootIdentity({
    identifier: String(identifier),
    name: customerName.value,
    email: userStore.userInfo.email,
    phoneNumber: userStore.userInfo.phone,
    customAttributes: customAttributes.value,
  })
}

useEventListener(window, 'chatwoot:ready', () => {
  syncIdentity()
})

onMounted(async () => {
  try {
    await loadChatwoot({
      locale: localeStore.currentLocale,
      darkMode: themeStore.isDarkTheme ? 'dark' : 'light',
      position: chatwootPositionForRoute(),
    })
    syncIdentity()
  }
  catch (err) {
    console.error('[LiveChat] Chatwoot SDK load failed', err)
  }
})

watch(() => route.name, () => {
  setChatwootPosition(chatwootPositionForRoute())
})

watch(
  () => [
    userStore.userInfo.id,
    userStore.userInfo.userName,
    userStore.userInfo.email,
    userStore.userPayInfo.maxWindowCount,
    userStore.userPayInfo.balance,
  ] as const,
  () => {
    syncIdentity()
  },
)

watch(() => userStore.token, (token, prevToken) => {
  if (!token && prevToken) {
    resetChatwoot()
  }
})

watch(() => localeStore.currentLocale, (locale) => {
  globalThis.$chatwoot?.setLocale(toChatwootLocale(locale))
})
</script>

<template>
  <div class="hidden" />
</template>
