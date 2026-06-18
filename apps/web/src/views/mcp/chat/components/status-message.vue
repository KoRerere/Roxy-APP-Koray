<script setup lang="ts">
import type { AgentErrorData } from '../../utils/agent-error'
import { resolveAgentError } from '../../utils/agent-error'
import { copyText } from '/@/utils/basic'
import { useResponseToast } from '/@/hooks/useResponseToast'

const { data } = defineProps<{
  data?: AgentErrorData | string
}>()

const [showToast, onlyErrorToast] = useResponseToast()

const resolved = computed(() => resolveAgentError(data))
const message = computed(() => resolved.value.message)
const requestId = computed(() => resolved.value.requestId)

async function copyRequestId() {
  if (!requestId.value)
    return
  try {
    await copyText(requestId.value)
    showToast(0, $t('复制成功'))
  }
  catch (error) {
    console.error('Failed to copy request id:', error)
    onlyErrorToast(-1, $t('复制失败，请重试'))
  }
}
</script>

<template>
  <div class="flex status-message status-error">
    <div class="flex items-center gap-1.5">
      <SvgIcon name="base/rx_ic_delete" size="14" />
      <span>{{ message }}</span>
    </div>
    <span v-if="requestId">
      <I18nT :keypath="$t('请求 ID：{requestId}', { requestId: '{requestId}' })">
        <template #requestId>
          <a class="underline cursor-pointer text-[var(--colors-text-text-error)]" @click="copyRequestId">
            {{ requestId }}
          </a>
        </template>
      </I18nT>
    </span>
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
