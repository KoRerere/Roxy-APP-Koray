<script setup lang="tsx">
import { usePopupMenu } from '/@/hooks/usePopupMenu'
import { useChatStreamStore } from '/@/views/mcp/pinia-store/useChatStreamStore'
import type { RecordingPhase, RecordingUIStatus } from '/@/views/mcp/agent-api'
import { isScriptRecordingEnabled } from '/@/utils/app-supports'

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  recordingDisabled: false,
  recordingStatus: 'idle',
})

const emit = defineEmits<Emits>()
const { showMenu } = usePopupMenu()
const chatStore = useChatStreamStore()

interface Props {
  canUploadMore: boolean
  conversationId?: string
  pendingScript?: any
  disabled?: boolean
  recordingDisabled?: boolean
  recordingStatus?: RecordingUIStatus
  recordingPhase?: RecordingPhase
}

interface Emits {
  (e: 'upload'): void
  (e: 'removeScript'): void
  (e: 'startRecording'): void
  (e: 'stopRecording'): void
  (e: 'stopGeneration'): void
  (e: 'retryGeneration'): void
}

const mode = defineModel<'orchestrator' | 'simple'>('mode', { required: true })

// 脚本录制入口受 ENABLE_SCRIPT_RECORDING env 控制，默认隐藏
const scriptRecordingEnabled = isScriptRecordingEnabled()

// ---- 审批模式下拉（Codex 风格） ----
// fullAccess=true ⇒ 完全访问权限（跳过 HITL，所有操作直接执行）
// fullAccess=false ⇒ 请求批准（默认，每次操作前确认）
type AccessMode = 'ask' | 'full'
const accessMenuOpen = ref(false)
let removeAccessMenuOpenListener: (() => void) | null = null

const accessMode = computed<AccessMode>(() => (chatStore.fullAccess ? 'full' : 'ask'))

const accessOptions: { value: AccessMode, icon: string, title: () => string, desc: () => string }[] = [
  {
    value: 'ask',
    icon: 'base/rx_ic_ask',
    title: () => $t('请求批准'),
    desc: () => $t('执行不可逆操作前，均需获得您的确认'),
  },
  {
    value: 'full',
    icon: 'base/rx_ic_allow',
    title: () => $t('完全访问权限'),
    desc: () => $t('无需确认直接执行所有操作'),
  },
]

const currentAccessOption = computed(() => accessOptions.find(o => o.value === accessMode.value)!)

const accessButtonLabel = computed(() => currentAccessOption.value.title())

const accessButtonTooltip = computed(() =>
  chatStore.fullAccess
    ? $t('当前为「完全访问权限」：Agent 无需确认直接执行所有操作（含文件修改、命令执行、删除等），仅对当前会话生效。点击可切换。')
    : $t('当前为「请求批准」：Agent 每次操作前会暂停等你确认。点击可切换为「完全访问权限」。'),
)

// 触发器与相邻 capsule（上传/多窗口并行）统一：两种状态都用 segment 底色，
// 仅激活「完全访问权限」时把文字/图标色切到 warning（light/dark 自适应）
const accessButtonToneClass = computed(() =>
  chatStore.fullAccess
    ? 'bg-[var(--component-segment-bg-selection)] text-[var(--colors-text-text-warning)] hover:bg-[var(--colors-background-bg-action-hover)]'
    : 'bg-[var(--component-segment-bg-selection)] text-[var(--colors-text-text-primary)] hover:bg-[var(--colors-background-bg-action-hover)]',
)

function trackMenuOpen(openRef: Ref<boolean>) {
  removeAccessMenuOpenListener?.()
  openRef.value = true
  const handler = () => {
    openRef.value = false
    removeAccessMenuOpenListener = null
  }
  document.addEventListener('click', handler, { once: true, capture: true })
  removeAccessMenuOpenListener = () => {
    document.removeEventListener('click', handler, true)
    removeAccessMenuOpenListener = null
  }
}

function buildAccessMenuOptions() {
  return accessOptions.map(option => ({
    label: option.title(),
    command: () => {
      chatStore.fullAccess = option.value === 'full'
    },
    render: () => (
      <div class={[
        'flex items-start gap-2 w-full px-2.5 py-2 rounded-[var(--p-menu-item-border-radius)] cursor-pointer hover:bg-[var(--colors-background-bg-action-hover)]',
        option.value === accessMode.value && 'bg-[var(--colors-background-bg-action-hover)]',
      ]}
      >
        <SvgIcon name={option.icon} size="16" class="mt-0.5 shrink-0" color="var(--colors-icon-icon-secondary)" />
        <div class="min-w-0 flex-1">
          <div class="flex items-center gap-1.5">
            <span class="truncate text-3.25 text-[var(--colors-text-text-primary)]">{option.title()}</span>
            {option.value === accessMode.value && (
              <SvgIcon name="base/rx_ic_check" size="14" color="var(--colors-icon-icon-brand)" class="shrink-0" />
            )}
          </div>
          <div class="mt-0.5 text-3 text-[var(--colors-text-text-tertiary)] leading-4">
            {option.desc()}
          </div>
        </div>
      </div>
    ),
  }))
}

function showAccessMenu(event: MouseEvent) {
  if (props.disabled)
    return
  trackMenuOpen(accessMenuOpen)
  showMenu(event, {
    model: [
      {
        disabled: true,
        render: () => (
          <div class="flex items-start gap-2 px-2.5 pt-2.5 pb-1.5">
            <SvgIcon name="base/rx_ic_eye" size="16" class="mt-0.5 shrink-0" color="var(--colors-icon-icon-tertiary)" />
            <div class="min-w-0 flex-1 text-3 text-[var(--colors-text-text-tertiary)] leading-4">
              {$t('选择 Agent 的操作权限：批准后执行，或无需确认直接执行。')}
            </div>
          </div>
        ),
      },
      { separator: true },
      ...buildAccessMenuOptions(),
    ],
    menuProps: { style: { minWidth: '240px', maxWidth: '320px' } },
  })
}

const isRecording = computed(() => props.recordingStatus === 'active')
const isProcessing = computed(() => props.recordingStatus === 'processing')
const isRecordingDone = computed(() => props.recordingStatus === 'done' || props.recordingStatus === 'cancelled')
// 重试：在脚本生成取消/失败/完成后展示（复用上次录制工作区重新生成）
const canRetry = computed(() =>
  props.recordingStatus === 'cancelled'
  || props.recordingStatus === 'failed'
  || props.recordingStatus === 'done',
)
const isRefineProcessing = computed(() => isProcessing.value && props.recordingPhase === 'refine')
const isEnhanceProcessing = computed(() => isProcessing.value && props.recordingPhase === 'enhance')
const isRecordingDisabledByMode = computed(() => mode.value === 'orchestrator')

const recordingButtonLabel = computed(() => {
  if (isRecording.value)
    return $t('停止录制')
  if (isRefineProcessing.value)
    return $t('定位稳定化')
  if (isEnhanceProcessing.value)
    return $t('脚本增强')
  if (isProcessing.value)
    return $t('生成脚本')
  if (props.recordingStatus === 'cancelled')
    return $t('已取消')
  if (isRecordingDone.value)
    return $t('脚本已生成')
  return $t('录制')
})

const recordingButtonTooltip = computed(() => {
  if (isRecordingDisabledByMode.value)
    return $t('录制不支持多窗口并行模式，请关闭"多窗口并行"后再录制')
  if (isRecording.value)
    return $t('停止录制并生成自动化脚本')
  if (isRefineProcessing.value)
    return $t('正在稳定页面元素定位，请稍候...')
  if (isEnhanceProcessing.value)
    return $t('正在增强脚本控制流并保存产物，请稍候...')
  if (isProcessing.value)
    return $t('正在整理录制内容并生成脚本，请稍候...')
  if (props.recordingStatus === 'cancelled')
    return $t('脚本生成已被取消')
  if (isRecordingDone.value)
    return $t('录制完成，已生成可复用自动化脚本')
  return $t('开始录制浏览器操作，停止后自动生成可复用的自动化脚本')
})

const recordingButtonToneClass = computed(() => {
  if (isRecordingDisabledByMode.value || (props.recordingDisabled && !isRecording.value))
    return 'opacity-40 cursor-not-allowed bg-[var(--component-segment-bg-selection)] text-[var(--colors-text-text-tertiary)]'
  if (isRecording.value)
    return 'bg-[#FEE2E2] text-[#DC2626] dark:bg-[#450A0A] dark:text-[#FCA5A5] cursor-pointer'
  if (isRefineProcessing.value)
    return 'bg-[#DBEAFE] text-[#2563EB] dark:bg-[#172554] dark:text-[#93C5FD] cursor-not-allowed'
  if (isEnhanceProcessing.value)
    return 'bg-[#F3E8FF] text-[#9333EA] dark:bg-[#3B0764] dark:text-[#D8B4FE] cursor-not-allowed'
  if (isProcessing.value)
    return 'bg-[#FEF3C7] text-[#D97706] dark:bg-[#451A03] dark:text-[#FCD34D] cursor-not-allowed'
  if (props.recordingStatus === 'cancelled')
    return 'bg-[#FEF3C7] text-[#D97706] dark:bg-[#451A03] dark:text-[#FCD34D] cursor-default'
  if (isRecordingDone.value)
    return 'bg-[#D1FAE5] text-[#059669] dark:bg-[#052E16] dark:text-[#6EE7B7] cursor-default'
  return 'bg-[var(--component-segment-bg-selection)] text-[var(--colors-text-text-primary)] hover:bg-[var(--colors-background-bg-action-hover)] cursor-pointer'
})

function onClickRecording() {
  if (isProcessing.value || isRecordingDisabledByMode.value || (props.recordingDisabled && !isRecording.value))
    return
  if (isRecording.value) {
    emit('stopRecording')
  }
  else if (!isProcessing.value && !isRecordingDone.value) {
    emit('startRecording')
  }
}

function onClickUpload() {
  if (!props.canUploadMore)
    return
  emit('upload')
}

onBeforeUnmount(() => {
  removeAccessMenuOpenListener?.()
})
</script>

<template>
  <div class="flex items-center gap-3">
    <!-- 多窗口并行开关 -->
    <button type="button" class="inline-flex items-center gap-1.5 h-[30px] px-3 border-0 rounded-[31px] bg-[var(--component-segment-bg-selection)] text-[var(--colors-text-text-primary)] text-sm leading-5 cursor-pointer" @click="mode = mode === 'simple' ? 'orchestrator' : 'simple'">
      <RxToggleSwitch :model-value="mode" :disabled="disabled" class="-ml-2 -mr-1 scale-70" true-value="orchestrator" false-value="simple" />
      <span v-tooltip.top="{ value: $t('打开该选项后，可以让 Roxy AI Agent 同时并行操作多个窗口执行任务。同时您的 Token 会消耗得更快。'), showDelay: 300 }">
        {{ $t('多窗口并行') }}
      </span>
    </button>

    <template v-if="scriptRecordingEnabled">
      <button
        v-tooltip.top="{ value: recordingButtonTooltip, showDelay: 300 }"
        type="button"
        class="inline-flex items-center gap-1.5 h-[30px] px-3 border-0 rounded-[31px] text-sm leading-5 transition-colors duration-200"
        :class="recordingButtonToneClass"
        @click="onClickRecording"
      >
        <span v-if="isRecording" class="relative flex items-center justify-center w-3 h-3 shrink-0">
          <span class="animate-ping absolute inline-flex w-full h-full rounded-full bg-[#DC2626] opacity-60" />
          <span class="relative inline-flex rounded-full w-2 h-2 bg-[#DC2626]" />
        </span>
        <span v-else-if="isProcessing" class="w-3 h-3 shrink-0 border-2 border-current border-t-transparent rounded-full animate-spin" />
        <span v-else-if="recordingStatus === 'cancelled'" class="w-2 h-2 rounded-full bg-[#D97706] shrink-0" />
        <span v-else-if="isRecordingDone" class="w-2 h-2 rounded-full bg-[#059669] shrink-0" />
        <span v-else class="w-2.5 h-2.5 rounded-full border-2 border-[#EF4444] shrink-0" />

        <span>{{ recordingButtonLabel }}</span>
      </button>

      <!-- 停止生成按钮（仅在 processing 时显示） -->
      <button
        v-if="isProcessing"
        v-tooltip.top="{ value: $t('停止生成脚本'), showDelay: 300 }"
        type="button"
        class="inline-flex items-center justify-center w-[30px] h-[30px] border-0 rounded-full bg-[var(--component-segment-bg-selection)] text-[var(--colors-text-text-tertiary)] hover:bg-[#FEE2E2] hover:text-[#DC2626] dark:hover:bg-[#450A0A] dark:hover:text-[#FCA5A5] cursor-pointer transition-colors duration-200"
        @click="emit('stopGeneration')"
      >
        <SvgIcon name="base/rx_ic_browser_stop" size="16" />
      </button>

      <!-- 重试生成按钮（脚本生成取消/失败/完成后展示，复用上次工作区重新生成） -->
      <button
        v-else-if="canRetry"
        v-tooltip.top="{ value: $t('重试生成脚本'), showDelay: 300 }"
        type="button"
        class="inline-flex items-center justify-center w-[30px] h-[30px] border-0 rounded-full bg-[var(--component-segment-bg-selection)] text-[var(--colors-text-text-tertiary)] hover:bg-[#DBEAFE] hover:text-[#2563EB] dark:hover:bg-[#172554] dark:hover:text-[#93C5FD] cursor-pointer transition-colors duration-200"
        @click="emit('retryGeneration')"
      >
        <SvgIcon name="base/rx_ic_refresh" size="16" />
      </button>
    </template>

    <!-- 上传按钮 -->
    <button type="button" class="inline-flex items-center gap-1.5 h-[30px] px-3 border-0 rounded-[31px] bg-[var(--component-segment-bg-selection)] text-[var(--colors-text-text-primary)] text-sm leading-5 cursor-pointer" :class="{ 'opacity-40 cursor-not-allowed': !canUploadMore }">
      <div class="flex items-center gap-1.5 transition-opacity duration-200" :class="canUploadMore ? 'cursor-pointer' : 'opacity-30 cursor-not-allowed'" @click="onClickUpload">
        <SvgIcon name="base/rx_ic_attachment" color="var(--colors-icon-icon-tertiary)" />
        <span>{{ $t('上传') }}</span>
      </div>
    </button>

    <!-- 审批模式下拉（Codex 风格）：请求批准 / 完全访问权限 -->
    <button
      v-tooltip.top="{ value: accessButtonTooltip, showDelay: 300 }"
      type="button"
      class="inline-flex items-center gap-1.5 h-[30px] px-3 border-0 rounded-[31px] text-sm leading-5 cursor-pointer transition-colors duration-200"
      :class="accessButtonToneClass"
      @click.stop="showAccessMenu"
    >
      <SvgIcon
        :name="currentAccessOption.icon"
        size="16"
        color="currentColor"
        class="shrink-0"
      />
      <span class="whitespace-nowrap">{{ accessButtonLabel }}</span>
      <SvgIcon
        name="base/rx_ic_chevron_down"
        size="14"
        color="currentColor"
        :class="{ 'rotate-180': accessMenuOpen }"
        class="shrink-0 transition-transform duration-200"
      />
    </button>

    <!-- 脚本标签 -->
    <button v-if="scriptRecordingEnabled && pendingScript" type="button" class="inline-flex items-center gap-1.5 h-[30px] px-3 border-0 rounded-[31px] bg-[var(--component-segment-bg-selection)] text-[var(--colors-text-text-primary)] text-sm leading-5 cursor-pointer">
      <div class="relative bg-[var(--colors-background-bg-block)] overflow-hidden flex items-center gap-1.5 rounded-1.5 pr-1.5">
        <div class="flex items-center">
          <div class="p-1 flex items-center justify-center">
            <SvgIcon name="base/rx_ic_doc_api" size="16" color="var(--colors-icon-icon-secondary)" />
          </div>
          <span class="text-3 text-[var(--colors-text-text-primary)] leading-20px">
            {{ pendingScript.name }}
          </span>
        </div>
        <SvgIcon name="base/rx_ic_delete" size="12" color="var(--colors-icon-icon-tertiary)" class="cursor-pointer" @click="emit('removeScript')" />
      </div>
    </button>
  </div>
</template>
