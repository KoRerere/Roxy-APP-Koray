<script setup lang="tsx">
import { usePopupMenu } from '/@/hooks/usePopupMenu'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { useMcpDataStore } from '/@/views/mcp/pinia-store/mcp-data-store'
import type { UserModelOption } from '/@/views/mcp/agent-api'
import { AUTOMATION_MODEL_TYPE } from '/@/views/mcp/model-config'

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
})

const emit = defineEmits<Emits>()
const [, onlyErrorToast] = useResponseToast()
const { showMenu } = usePopupMenu()
const mcpDataStore = useMcpDataStore()

interface Props {
  canUploadMore: boolean
  pendingScript?: any
  disabled?: boolean
}

interface Emits {
  (e: 'upload'): void
  (e: 'removeScript'): void
}

const mode = defineModel<'orchestrator' | 'simple'>('mode', { required: true })
const modelMenuOpen = ref(false)
const isSwitchingModel = ref(false)
let removeModelMenuOpenListener: (() => void) | null = null

const { modelOptionsMap, modelOptionsLoading, userModel, userModelLoading } = storeToRefs(mcpDataStore)
const currentModelConfig = computed(() => userModel.value?.[AUTOMATION_MODEL_TYPE])
const currentModelName = computed(() => currentModelConfig.value?.model?.trim() || '')
const automationModelOptions = computed(() => modelOptionsMap.value[AUTOMATION_MODEL_TYPE] || [])
const currentModelOption = computed(() =>
  automationModelOptions.value.find(option => option.model === currentModelName.value),
)
const modelButtonLabel = computed(() => {
  if (currentModelOption.value)
    return getModelOptionLabel(currentModelOption.value)
  if (currentModelName.value)
    return currentModelName.value
  return userModelLoading.value ? $t('加载中') : $t('默认模型')
})

function getModelOptionLabel(option: UserModelOption) {
  return option.alias?.trim() || option.model
}

function trackMenuOpen(openRef: Ref<boolean>) {
  removeModelMenuOpenListener?.()
  openRef.value = true
  const handler = () => {
    openRef.value = false
    removeModelMenuOpenListener = null
  }
  document.addEventListener('click', handler, { once: true, capture: true })
  removeModelMenuOpenListener = () => {
    document.removeEventListener('click', handler, true)
    removeModelMenuOpenListener = null
  }
}

async function refreshCurrentModel() {
  try {
    await mcpDataStore.fetchUserModel()
  }
  catch (error: any) {
  }
}

async function ensureModelOptions() {
  try {
    const data = await mcpDataStore.fetchModelOptions(AUTOMATION_MODEL_TYPE)
    if (data !== null)
      return true
  }
  catch (error: any) {
  }

  return false
}

function buildModelMenuOptions(options: UserModelOption[]) {
  if (!options.length) {
    return [{
      label: $t('暂无可用模型'),
      disabled: true,
      render: () => (
        <div class="px-2.5 py-2 text-3.25 text-[var(--colors-text-text-tertiary)]">
          {$t('暂无可用模型')}
        </div>
      ),
    }]
  }

  return options.map(option => ({
    label: getModelOptionLabel(option),
    command: () => {
      void handleModelSelect(option)
    },
    render: () => (
      <div class={[
        'flex items-center justify-between gap-3 w-full px-2.5 py-2 rounded-[var(--p-menu-item-border-radius)] cursor-pointer hover:bg-[var(--colors-background-bg-action-hover)]',
        option.model === currentModelName.value && 'bg-[var(--colors-background-bg-action-hover)]',
      ]}
      >
        <div class="min-w-0 flex-1">
          <div class="truncate text-3.25 text-[var(--colors-text-text-primary)]">{getModelOptionLabel(option)}</div>
        </div>
      </div>
    ),
  }))
}

async function handleModelSelect(option: UserModelOption) {
  if (isSwitchingModel.value || option.model === currentModelName.value)
    return

  isSwitchingModel.value = true
  const previousModelInfo = userModel.value
    ? JSON.parse(JSON.stringify(userModel.value))
    : null
  try {
    userModel.value = {
      ...(userModel.value || {}),
      [AUTOMATION_MODEL_TYPE]: {
        model: option.model,
        api_format: option.api_format,
      },
    }

    const res = await mcpDataStore.switchUserModel(AUTOMATION_MODEL_TYPE, option.model)
    if (res.code === 0) {
      return
    }
    userModel.value = previousModelInfo
    onlyErrorToast(-1, res.msg || res.message || $t('切换模型失败'))
  }
  catch (error: any) {
    userModel.value = previousModelInfo
    await refreshCurrentModel()
    onlyErrorToast(-1, error?.message || $t('切换模型失败'))
  }
  finally {
    isSwitchingModel.value = false
  }
}

function showModelMenu(event: MouseEvent) {
  if (props.disabled || isSwitchingModel.value)
    return

  trackMenuOpen(modelMenuOpen)
  if (!automationModelOptions.value.length) {
    modelMenuOpen.value = false
    void ensureModelOptions()
    return
  }

  showMenu(event, {
    model: buildModelMenuOptions(automationModelOptions.value),
    menuProps: { style: { minWidth: '220px', maxWidth: '320px' } },
  })
}

function onClickUpload() {
  if (!props.canUploadMore)
    return
  emit('upload')
}

onMounted(() => {
  if (!userModel.value && !userModelLoading.value)
    void refreshCurrentModel()
  if (!automationModelOptions.value.length && !modelOptionsLoading.value[AUTOMATION_MODEL_TYPE])
    void ensureModelOptions()
})

onBeforeUnmount(() => {
  removeModelMenuOpenListener?.()
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

    <!-- 上传按钮 -->
    <button type="button" class="inline-flex items-center gap-1.5 h-[30px] px-3 border-0 rounded-[31px] bg-[var(--component-segment-bg-selection)] text-[var(--colors-text-text-primary)] text-sm leading-5 cursor-pointer" :class="{ 'opacity-40 cursor-not-allowed': !canUploadMore }">
      <div class="flex items-center gap-1.5 transition-opacity duration-200" :class="canUploadMore ? 'cursor-pointer' : 'opacity-30 cursor-not-allowed'" @click="onClickUpload">
        <SvgIcon name="base/rx_ic_attachment" color="var(--colors-icon-icon-tertiary)" />
        <span>{{ $t('上传') }}</span>
      </div>
    </button>

    <div class="inline-flex items-center gap-1 h-[30px] rounded-[60px] bg-[var(--component-segment-bg-selection)]">
      <button
        v-tooltip.top="{ value: $t('切换当前自动化对话使用的模型'), showDelay: 300 }"
        type="button"
        class="flex items-center gap-1.5 h-[30px] px-3 border-0 rounded-15 bg-transparent text-[var(--colors-text-text-primary)] text-sm leading-5 cursor-pointer whitespace-nowrap overflow-hidden hover:bg-[var(--component-table-bg-button-hover)]"
        :class="{ 'opacity-50 cursor-not-allowed': disabled || isSwitchingModel }"
        @click.stop="showModelMenu"
      >
        <span class="max-w-[180px] truncate">{{ modelButtonLabel }}</span>
        <SvgIcon
          name="base/rx_ic_chevron_down"
          size="16"
          color="var(--colors-icon-icon-primary)"
          :class="{ 'rotate-180': modelMenuOpen }"
          class="shrink-0 transition-transform duration-200"
        />
      </button>
    </div>

    <!-- 脚本标签 -->
    <button v-if="pendingScript" type="button" class="inline-flex items-center gap-1.5 h-[30px] px-3 border-0 rounded-[31px] bg-[var(--component-segment-bg-selection)] text-[var(--colors-text-text-primary)] text-sm leading-5 cursor-pointer">
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
