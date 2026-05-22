<script setup lang="ts">
import { LiveChatWidget } from '@livechat/widget-vue'

const visibility = ref('hidden')

const sessionVariables = computed(() => {
  const { username } = globalThis.$softConfig.userInfo || {}
  const { maxWindowCount, useWindowCount } = globalThis.$softConfig.userPayInfo || {}
  return {
    username: `[Roxy]-${username}-总窗口${maxWindowCount}/已用-${useWindowCount}-[拟卸载用户]`,
    Account_ID: globalThis.$softConfig.token,
    // Total_order_value: `$${totalAmount / 100}`
  }
})
const customerName = computed(() => {
  const { username } = globalThis.$softConfig.userInfo || {}
  return `[Roxy]-${username || '游客'}-[拟卸载用户]`
})

function handleVisibilityChanged(data: any) {
  console.log('data.visibility', data.visibility)
  visibility.value = data.visibility
}

onErrorCaptured((err) => {
  console.error('LiveChatWidget error', err)
})
</script>

<template>
  <LiveChatWidget license="18087441" :customer-name="customerName"
                  :session-variables="sessionVariables" :visibility="visibility" @visibility-changed="handleVisibilityChanged"
  />
</template>

<style></style>
