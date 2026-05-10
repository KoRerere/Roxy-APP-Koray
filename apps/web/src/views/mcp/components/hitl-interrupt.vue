<script setup lang="ts">
import type { HitlDecision, HitlDecisionType } from '/@/views/mcp/types'

const props = defineProps<{
  reviewConfigs: Array<{ actionName: string }>
  /** 后端 hitl_resume 事件回填的决策：有值 = 该断点已处理完毕 */
  decisions?: HitlDecision[]
}>()

const emit = defineEmits<{
  (e: 'approve'): void
  (e: 'reject'): void
}>()

/** 本地提交态：点击按钮后到收到 hitl_resume 之间显示 loading。收到后由 decisions 接管。 */
const pendingType = ref<HitlDecisionType | null>(null)

const resolvedType = computed<HitlDecisionType | undefined>(() => props.decisions?.[0]?.type)

// 服务端回填后清理本地提交态
watch(resolvedType, (val) => {
  if (val)
    pendingType.value = null
})

const isResolved = computed(() => !!resolvedType.value)
const isPending = computed(() => !!pendingType.value)

const activeInterruptText: Record<string, string> = {
  roxy_delete_browsers: $t('是否允许执行删除窗口操作？'),
}

const resolvedMeta = computed(() => {
  switch (resolvedType.value) {
    case 'approve':
      return { label: $t('已允许'), icon: 'base/rx_ic_check', color: 'var(--colors-icon-icon-success)' }
    case 'reject':
      return { label: $t('已拒绝'), icon: 'base/rx_ic_video_close', color: 'var(--colors-icon-icon-error)' }
    case 'edit':
      return { label: $t('已编辑'), icon: 'base/rx_ic_edit', color: 'var(--colors-icon-icon-action)' }
    default:
      return null
  }
})

function onApprove() {
  if (isResolved.value || isPending.value)
    return
  pendingType.value = 'approve'
  emit('approve')
}

function onReject() {
  if (isResolved.value || isPending.value)
    return
  pendingType.value = 'reject'
  emit('reject')
}
</script>

<template>
  <div class="min-h-56px py-2 px-3 justify-between items-center flex bg-[var(--colors-background-bg-block)] rounded-2.5">
    <div class="text-[var(--colors-text-text-primary)] text-3 font-500 leading-16px font-[Inter]">
      <template v-for="item in reviewConfigs" :key="item.actionName">
        {{ activeInterruptText[item.actionName] || item.actionName }}
      </template>
    </div>

    <!-- 已有决策：显示结果徽标 -->
    <div v-if="isResolved && resolvedMeta" class="flex items-center gap-1">
      <SvgIcon :name="resolvedMeta.icon" size="14" :color="resolvedMeta.color" />
      <span class="text-3 leading-16px" :style="{ color: resolvedMeta.color }">{{ resolvedMeta.label }}</span>
    </div>

    <!-- 未决策：显示按钮；提交中：显示 loading -->
    <div v-else class="flex items-center gap-2">
      <RxButton
        :disabled="isPending"
        :loading="pendingType === 'approve'"
        severity="secondary"
        outlined
        icon="base/rx_ic_check"
        :label="$t('允许')"
        size="xxs"
        @click="onApprove"
      />
      <RxButton
        :disabled="isPending"
        :loading="pendingType === 'reject'"
        severity="secondary"
        text
        icon="base/rx_ic_video_close"
        :label="$t('拒绝')"
        size="xxs"
        @click="onReject"
      />
    </div>
  </div>
</template>
