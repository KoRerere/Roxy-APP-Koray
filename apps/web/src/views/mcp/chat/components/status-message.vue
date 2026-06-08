<script setup lang="ts">
import type { AgentErrorData } from '../../utils/agent-error'
import { resolveAgentError } from '../../utils/agent-error'

const { data } = defineProps<{
  data?: AgentErrorData | string
}>()

const resolved = computed(() => resolveAgentError(data))
const message = computed(() => resolved.value.message)
const requestId = computed(() => resolved.value.requestId)
</script>

<template>
  <div class="flex flex-col gap-0.5 status-message status-error">
    <div class="flex items-center gap-1.5">
      <SvgIcon name="base/rx_ic_delete" size="14" />
      <span>{{ message }}</span>
    </div>
    <span v-if="requestId" class="request-id">{{ $t('如需协助，请提供请求 ID：') }}{{ requestId }}</span>
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

.request-id {
  padding-left: 19.5px;
  font-size: 11px;
  opacity: 0.7;
  user-select: text;
}
</style>
