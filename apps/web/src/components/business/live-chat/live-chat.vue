<script setup lang="ts">
import { LiveChatWidget } from '@livechat/widget-vue'
import { useUserStore } from '/@/stores/user'
import { emitter } from '/@/utils/eventBus'
import type { MittEvents } from '/@/utils/eventBus'
import { useThemeStore } from '/@/stores/theme'
import { isCurrentEcommerceWorkspace } from '/@/utils/workspace-mode'

const userStore = useUserStore()
const route = useRoute()
const router = useRouter()
const themeStore = useThemeStore()
const visibility = ref<MittEvents['toggleChatVisible']>('hidden')

const sessionVariables = computed(() => {
  const { userName } = userStore.userInfo
  const { maxWindowCount, useWindowCount } = userStore.userPayInfo
  return {
    username: `[Roxy]-${userName}-总窗口${maxWindowCount}/已用-${useWindowCount}`,
    Account_ID: userStore.token,
    // Total_order_value: `$${totalAmount / 100}`
  }
})
const customerName = computed(() => {
  const { userName } = userStore.userInfo
  return `[Roxy]-[${isCurrentEcommerceWorkspace() ? '电商模式' : '普通模式'}]-${userName || '游客'}`
})

function handleVisibilityChanged(data: any) {
  console.log('data.visibility', data.visibility)
  visibility.value = data.visibility
}

// watch(() => themeStore.realTheme, (newVal) => {
//   console.log('newVal', newVal)
//   // LiveChatWidget?.call?.("destroy");
//   router.replace({ ...router.currentRoute.value, query: { ...route.query, theme: newVal } as Record<string, any> })
// }, { immediate: true })

emitter.on('toggleChatVisible', (_visibility) => {
  visibility.value = _visibility
})

onErrorCaptured((err) => {
  console.error('LiveChatWidget error', err)
})
</script>

<template>
  <LiveChatWidget :key="$route.query.theme" license="18087441" :customer-name="customerName"
                  :session-variables="sessionVariables" :visibility="visibility" @visibility-changed="handleVisibilityChanged"
  />
</template>

<style></style>
