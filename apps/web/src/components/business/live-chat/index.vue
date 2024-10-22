<script setup lang="ts">
import { LiveChatWidget } from '@livechat/widget-vue'
import { useUserStore } from '/@/stores/user'

const userStore = useUserStore()
const visibility = ref<'maximized' | 'minimized' | 'hidden'>('hidden')

const sessionVariables = computed(() => {
  const { userName, totalAmount, leftAmount, maxWindowCount, useWindowCount } = userStore.userInfo
  return {
    username: `[Lumi]-${userName}-总窗口${maxWindowCount}/已用-${useWindowCount}`,
    Account_ID: userStore.token,
    // Total_order_value: `$${totalAmount / 100}`
  }
})
const customerName = computed(() => {
  const { userName } = userStore.userInfo
  return `[Lumi]-${userName || '游客'}`
})

function toggleChatVisible() {
  visibility.value = visibility.value === 'maximized' ? 'hidden' : 'maximized'
}

function handleVisibilityChanged(data) {
  console.log('data.visibility', data.visibility)
  visibility.value = data.visibility
}
</script>

<template>
  <div class="cursor-pointer" v-bind="$attrs" @click="toggleChatVisible">
    <slot />
  </div>
  <LiveChatWidget
    license="18087441"
    :customer-name="customerName"
    :session-variables="sessionVariables"
    :visibility="visibility"
    @visibility-changed="handleVisibilityChanged"
  />
</template>

<style>

</style>
