<script setup lang="ts">
import type { ReplyEndStatus } from '../types'

const { status, message } = defineProps<{
  status: ReplyEndStatus
  message?: string
}>()

const data = computed(() => {
  return {
    class: status === 'error' ? 'status-error' : 'status-interrupt',
    text: message || (status === 'error' ? $t('发生错误') : $t('已中断')),
  }
})
</script>

<template>
  <div class="flex items-center gap-1.5 px-3 py-2 rounded-1 status-message" :class="data.class">
    <SvgIcon name="base/rx_ic_delete" size="14" />
    <span>{{ data.text }}</span>
  </div>
</template>

<style lang="scss" scoped>
.status-message {
  font-size: 12px;
  line-height: 1.5;
}

.status-error {
  background: var(--colors-background-bg-error-subtle);
  color: var(--colors-text-text-error);
}

.status-interrupt {
  background: var(--colors-background-bg-warning-subtle);
  color: var(--colors-text-text-warning);
}
</style>
