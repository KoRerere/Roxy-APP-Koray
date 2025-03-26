<script setup lang="ts">
import { LiveChatWidget, } from '@livechat/widget-vue'
import { useUserStore } from '/@/stores/user'
import { emitter, type MittEvents } from '/@/utils/eventBus'

const userStore = useUserStore()
const visibility = ref<MittEvents['toggleChatVisible']>('hidden')

const sessionVariables = computed(() => {
  const { userName, } = userStore.userInfo
  const { maxWindowCount, useWindowCount } = userStore.userPayInfo
  return {
    username: `[Roxy]-${userName}-总窗口${maxWindowCount}/已用-${useWindowCount}`,
    Account_ID: userStore.token,
    // Total_order_value: `$${totalAmount / 100}`
  }
})
const customerName = computed(() => {
  const { userName } = userStore.userInfo
  return `[Roxy]-${userName || '游客'}`
})

function handleVisibilityChanged(data) {
  console.log('data.visibility', data.visibility)
  visibility.value = data.visibility
}

emitter.on('toggleChatVisible', (_visibility) => {
  visibility.value = _visibility
})

onErrorCaptured((err) => {
  console.error('LiveChatWidget error', err)
})
</script>

<template>
  <LiveChatWidget license="18087441" :customer-name="customerName" :session-variables="sessionVariables"
    :visibility="visibility" @visibility-changed="handleVisibilityChanged" />
</template>

<style></style>
