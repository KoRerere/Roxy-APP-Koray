<script setup lang="ts">
import { applyChatwootIdentity, loadChatwoot } from '/@/components/business/live-chat/chatwoot'

const { userName, userId } = defineProps<{
  /** 当前登录用户名，未登录时走访客文案 */
  userName?: string
  /** 用户 ID，作为 Chatwoot 联系人 identifier */
  userId?: number
}>()

const customerName = computed(() => {
  return userName ? `[Roxy]-${userName}` : '[Roxy]-代理IP置换公告访客'
})

const customAttributes = computed(() => ({
  username: userName ? `[Roxy]-${userName}-代理IP置换公告页` : '[Roxy]-代理IP置换公告页',
  Account_ID: String(userId ?? ''),
}))

/** 用户信息到达后再绑定联系人，避免把登录 token 当作 identifier */
function syncIdentity() {
  applyChatwootIdentity({
    identifier: userId ? String(userId) : undefined,
    name: customerName.value,
    customAttributes: customAttributes.value,
  })
}

onMounted(async () => {
  try {
    await loadChatwoot()
    syncIdentity()
  }
  catch (err) {
    console.error('[ProxySegmentReplaceLiveChat] Chatwoot SDK load failed', err)
  }
})

watch(() => [userName, userId] as const, () => {
  syncIdentity()
})
</script>

<template>
  <div class="hidden" />
</template>
