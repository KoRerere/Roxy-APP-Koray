<script setup lang="tsx">
import type { HitlDecision, HitlDecisionType } from '/@/views/mcp/types'

const props = defineProps<{
  actionRequests?: { name: string, args: Record<string, any> }[]
  reviewConfigs: Array<{ actionName: string }>
  /** 后端 hitl_resume 事件回填的决策：有值 = 该断点已处理完毕 */
  decisions?: HitlDecision[]
  isChatting: boolean
}>()

const emit = defineEmits<{
  (e: 'decide', decisions: HitlDecision[]): void
}>()

// 审批列表
const approvalList = ref<{ name: string, args: Record<string, any>, component: any }[]>([])

/** 每个 action request 的独立决策状态 */
const itemDecisions = ref<(HitlDecisionType | null)[]>([])

/** 是否已全部由服务端回填 */
const isAllResolved = computed(() =>
  !!props.decisions?.length && props.decisions.length >= approvalList.value.length,
)

/** 是否已全部本地决策并提交中 */
const isSubmitting = ref(false)

function getResolvedMeta(type: HitlDecisionType | undefined | null) {
  switch (type) {
    case 'approve':
      return { label: $t('已允许'), icon: 'base/rx_ic_check', color: 'var(--colors-icon-icon-success)' }
    case 'reject':
      return { label: $t('已拒绝'), icon: 'base/rx_ic_video_close', color: 'var(--colors-icon-icon-error)' }
    case 'edit':
      return { label: $t('已编辑'), icon: 'base/rx_ic_edit', color: 'var(--colors-icon-icon-action)' }
    default:
      return null
  }
}

function onItemApprove(index: number) {
  onItemDecide(index, 'approve')
}

function onItemReject(index: number) {
  onItemDecide(index, 'reject')
}

function onItemDecide(index: number, type: HitlDecisionType) {
  if (isAllResolved.value || isSubmitting.value || itemDecisions.value[index] !== null)
    return
  itemDecisions.value[index] = type

  // 所有 item 都已决策，自动提交
  if (itemDecisions.value.length > 0 && itemDecisions.value.every(d => d !== null)) {
    isSubmitting.value = true
    emit('decide', itemDecisions.value.map(d => ({ type: d! })))
  }
}

onMounted(async () => {
  if (props.actionRequests) {
    for (const request of props.actionRequests) {
      switch (request.name) {
        case 'roxy_delete_browsers':
          approvalList.value.push({
            name: request.name,
            args: request.args,
            component: $t('Roxy Agent 即将删除 {n} 窗口', { n: request.args.dirIds.length || 1 }),
          })
          break
        case 'roxy_delete_proxies':
          approvalList.value.push({
            name: request.name,
            args: request.args,
            component: $t('Roxy Agent 即将删除 {n} 代理 IP', { n: request.args.ids.length || 1 }),
          })
          break
        case 'roxy_delete_accounts':
          approvalList.value.push({
            name: request.name,
            args: request.args,
            component: $t('Roxy Agent 即将删除 {n} 账号', { n: request.args.ids.length || 1 }),
          })
          break
        case 'read_file':
          approvalList.value.push({
            name: request.name,
            args: request.args,
            component: $t('Roxy Agent 即将读取 {file_path} 文件内容', { ...request.args }),
          })
          break
        case 'execute':
          approvalList.value.push({
            name: request.name,
            args: request.args,
            component: $t('Roxy Agent 即将执行 {command} 命令', { ...request.args }),
          })
          break
        default: return
      }
    }
    // 初始化每个 item 的决策状态
    itemDecisions.value = Array.from<HitlDecisionType | null>({ length: approvalList.value.length }).fill(null)
  }
})
</script>

<template>
  <div v-if="!isAllResolved" class="flex flex-col gap-3">
    <div v-for="(item, index) in approvalList" :key="item.name" class="min-h-56px py-2 px-3 justify-between items-center flex bg-[var(--colors-background-bg-block)] rounded-2.5 gap-5">
      <div class="text-[var(--colors-text-text-primary)] text-3 font-500 leading-16px font-[Inter] break-all">
        {{ item.component }}
      </div>

      <template v-if="isChatting">
        <!-- 已有服务端回填决策：显示结果徽标 -->
        <div v-if="isAllResolved && getResolvedMeta(decisions?.[index]?.type)" class="flex items-center gap-1">
          <SvgIcon :name="getResolvedMeta(decisions?.[index]?.type)!.icon" size="14" :color="getResolvedMeta(decisions?.[index]?.type)!.color" />
          <span class="text-3 leading-16px" :style="{ color: getResolvedMeta(decisions?.[index]?.type)!.color }">{{ getResolvedMeta(decisions?.[index]?.type)!.label }}</span>
        </div>

        <!-- 本地已决策：显示结果徽标 -->
        <div v-else-if="itemDecisions[index] !== null && getResolvedMeta(itemDecisions[index])" class="flex items-center gap-1">
          <SvgIcon :name="getResolvedMeta(itemDecisions[index])!.icon" size="14" :color="getResolvedMeta(itemDecisions[index])!.color" />
          <span class="text-3 leading-16px" :style="{ color: getResolvedMeta(itemDecisions[index])!.color }">{{ getResolvedMeta(itemDecisions[index])!.label }}</span>
          <SvgIcon v-if="isSubmitting" class="loading-circle" name="base/rx_ic_spin" size="12" color="var(--colors-icon-icon-tertiary)" />
        </div>

        <!-- 未决策：显示按钮 -->
        <div v-else class="flex items-center gap-2 whitespace-nowrap">
          <RxButton
            :disabled="isSubmitting"
            severity="secondary"
            outlined
            icon="base/rx_ic_check"
            :label="$t('允许')"
            size="xxs"
            @click="onItemApprove(index)"
          />
          <RxButton
            :disabled="isSubmitting"
            severity="secondary"
            text
            icon="base/rx_ic_video_close"
            :label="$t('拒绝')"
            size="xxs"
            @click="onItemReject(index)"
          />
        </div>
      </template>
    </div>
  </div>
</template>
