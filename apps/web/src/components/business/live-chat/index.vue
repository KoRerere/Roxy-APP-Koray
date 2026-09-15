<script setup lang="ts">
import { useToast } from 'primevue/usetoast'
import { toggleChatwoot } from './chatwoot'

const toast = useToast()

/** 登录页帮助按钮切换 Chatwoot 窗口 */
async function toggleChatVisible() {
  if (await toggleChatwoot()) {
    return
  }
  toast.add({
    severity: 'error',
    summary: `${$t('联系客服')} · ${$t('操作失败')}`,
    detail: $t('请检查网络连接后重试。'),
    life: 5000,
  })
}
</script>

<template>
  <div class="cursor-pointer" @click="toggleChatVisible">
    <slot />
  </div>
</template>
