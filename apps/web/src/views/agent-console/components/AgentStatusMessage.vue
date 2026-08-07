<script setup lang="ts">
import type { AgentErrorData } from '../utils/agent-error'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { copyText } from '/@/utils/basic'
import { resolveAgentError } from '../utils/agent-error'

const props = defineProps<{
  data?: AgentErrorData | string
}>()

const [showToast, onlyErrorToast] = useResponseToast()

const resolved = computed(() => resolveAgentError(props.data))
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
    console.error('[agent-console] Failed to copy request id:', error)
    onlyErrorToast(-1, $t('复制失败，请重试'))
  }
}
</script>

<template>
  <div class="agent-status-message" role="alert">
    <div class="agent-status-message__main">
      <SvgIcon name="base/rx_ic_delete" size="14" />
      <span>{{ message }}</span>
    </div>

    <span v-if="requestId" class="agent-status-message__request-id">
      <I18nT :keypath="$t('请求 ID：{requestId}', { requestId: '{requestId}' })">
        <template #requestId>
          <button type="button" @click="copyRequestId">
            {{ requestId }}
          </button>
        </template>
      </I18nT>
    </span>
  </div>
</template>

<style lang="scss" scoped>
.agent-status-message {
  display: flex;
  width: fit-content;
  max-width: 100%;
  flex-direction: column;
  gap: 4px;
  padding: 8px 10px;
  border: 1px solid color-mix(in srgb, var(--color-border-error, #f04438) 32%, transparent);
  border-radius: 8px;
  color: var(--color-text-error-primary, #f04438);
  background: var(--color-bg-error-primary, #fef3f2);
  box-sizing: border-box;
  font-size: 12px;
  line-height: 18px;
}

.agent-status-message__main {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 6px;
}

.agent-status-message__main span,
.agent-status-message__request-id {
  min-width: 0;
  overflow-wrap: anywhere;
}

.agent-status-message__main :deep(.svg) {
  flex: 0 0 auto;
  color: currentColor;
}

.agent-status-message__request-id button {
  padding: 0;
  border: 0;
  color: currentColor;
  background: transparent;
  cursor: pointer;
  font: inherit;
  text-decoration: underline;
}
</style>
