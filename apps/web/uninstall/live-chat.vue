<script setup lang="ts">
import { applyChatwootIdentity, loadChatwoot } from '/@/components/business/live-chat/chatwoot'

/** 卸载页从 Electron softConfig 读取的客服身份字段 */
interface UninstallSoftConfig {
  /** 客户端语言 */
  language?: string
  /** 上次登录用户 ID */
  lastUserId?: number
  /** 空间业务模式：0 普通 / 2 电商 */
  workspaceType?: number
  userInfo?: {
    /** 本地缓存的用户名 */
    username?: string
  }
  userPayInfo?: {
    /** 窗口总数 */
    maxWindowCount?: number
    /** 已用窗口数 */
    useWindowCount?: number
  }
}

const softConfig = (globalThis as typeof globalThis & { $softConfig?: UninstallSoftConfig }).$softConfig ?? {}

const customerName = computed(() => {
  const { username } = softConfig.userInfo || {}
  const { workspaceType } = softConfig
  return `[Roxy]-[${workspaceType === 2 ? '电商模式' : '普通模式'}]-${username || '游客'}-[拟卸载用户]`
})

const customAttributes = computed(() => {
  const { username } = softConfig.userInfo || {}
  const { maxWindowCount, useWindowCount } = softConfig.userPayInfo || {}
  return {
    username: `[Roxy]-${username}-总窗口${maxWindowCount}/已用-${useWindowCount}-[拟卸载用户]`,
    Account_ID: String(softConfig.lastUserId ?? ''),
  }
})

/** 卸载场景带上拟卸载标记，方便客服区分来源 */
function syncIdentity() {
  const identifier = softConfig.lastUserId
  if (!identifier) {
    return
  }

  applyChatwootIdentity({
    identifier: String(identifier),
    name: customerName.value,
    customAttributes: customAttributes.value,
  })
}

onMounted(async () => {
  try {
    await loadChatwoot({
      locale: softConfig.language,
    })
    syncIdentity()
  }
  catch (err) {
    console.error('[LiveChat] Chatwoot SDK load failed', err)
  }
})
</script>

<template>
  <div class="hidden" />
</template>
