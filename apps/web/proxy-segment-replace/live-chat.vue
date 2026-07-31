<script setup lang="ts">
import { LiveChatWidget } from '@livechat/widget-vue'
import { authToken } from './api'

const { userName } = defineProps<{
  userName?: string
}>()

const visibility = ref('hidden')

const sessionVariables = computed(() => ({
  username: userName ? `[Roxy]-${userName}-代理IP置换公告页` : '[Roxy]-代理IP置换公告页',
  Account_ID: authToken,
}))

const customerName = computed(() => {
  return userName ? `[Roxy]-${userName}` : '[Roxy]-代理IP置换公告访客'
})

function handleVisibilityChanged(data: { visibility: string }) {
  visibility.value = data.visibility
}

onErrorCaptured((err) => {
  console.error('[ProxySegmentReplaceLiveChat] widget error', err)
})
</script>

<template>
  <LiveChatWidget
    license="18087441"
    :customer-name="customerName"
    :session-variables="sessionVariables"
    :visibility="visibility"
    @visibility-changed="handleVisibilityChanged"
  />
</template>
