<script lang="ts" setup>
import type { CreatePageShared } from './useCreatePageShared'
import MateGroup from '../components/mate-group.vue'
import AccordionInputs from '../components/accordion-inputs.vue'
import PreviewCard from '../components/preview-card.vue'
import RxButton from '/@/components/rx-button'
import { RxInputNumber } from '/@/components/rx-input-number'
import { API } from '/@/api'
import { findInputByName } from '/@/utils'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { ceateRandomFinger } from '../form-inputs'
import { hasWindowName } from '../utils'
import { readSuggestedWindowName } from '../window-name'
import { AccountBindType } from '/@/enums/account'
import { createDefaultWindowAccordions } from './createDefaultAccordions'

const props = defineProps<{
  shared: CreatePageShared
}>()

const [, onlyErrorToast] = useResponseToast()
const accordions = ref(createDefaultWindowAccordions())

const {
  collapsed,
  inputsGroup,
  previewInputs,
  isBatch,
  createCount,
  maxWindowCount,
  shuffleFingerprint,
  choosePreset,
  profileTemplate,
  showTemplates,
  metaData,
  items,
  saveTemplatePopup,
  canSubmit,
  loading,
  formGate,
  clearDriver,
  prepareCreateParams,
  onBack,
  workspaceStore,
  userStore,
} = props.shared

async function createProfile() {
  await formGate.waitUntilReady()
  clearDriver()
  const params = await prepareCreateParams({
    inputs: inputsGroup.value,
    metadata: metaData.value,
    createCount: createCount.value,
  })
  return batchCreateProfile(params)
}

async function batchCreateProfile(params: any) {
  const { createCount: count, platformBindType, _custom_ua } = params
  const proxyInfoList = Array.isArray(params.proxyInfoList) ? params.proxyInfoList : []
  const windowPlatformList = Array.isArray(params.windowPlatformList) ? params.windowPlatformList : []
  const platformUrlIds = Array.isArray(params.platformUrlIds) ? params.platformUrlIds : []
  // 差异数量，代理总数量在 input 内的 formatValue 函数中有处理
  const proxyDiffCount = count - proxyInfoList.length
  if (proxyDiffCount < 0) {
    onlyErrorToast(-1, $t('代理 IP 数量不能大于窗口'))
    return
  }
  const accountDiffCount = count - windowPlatformList.length - platformUrlIds.length
  if (platformBindType === AccountBindType.Order && accountDiffCount < 0) {
    onlyErrorToast(-1, $t('账号数量不能大于窗口'))
    return
  }

  const suggestedName = readSuggestedWindowName(findInputByName(inputsGroup.value[0] ?? [], 'windowName'))
  // 名称为空时提交日期序号；不带平台缩写和代理国家
  if (suggestedName && !hasWindowName(params.windowName) && !hasWindowName(params.windowNamePrefix)) {
    params.windowNamePrefix = suggestedName
    params.windowName = suggestedName
  }

  loading.value = true
  const fingerDetail = await ceateRandomFinger(previewInputs.value, { count: params.createCount, preview: false })
  params.proxyInfoList = proxyInfoList.concat(Array.from({ length: proxyDiffCount }).fill({ id: 0, proxyCategory: 'noproxy' }))// 代理数量小于创建数量补充为直连
  params.fingerDetail = fingerDetail.map(({ userAgent, webGLManufacturer, webGLRender, ...item }: any) => {
    return {
      ...item,
      userAgent: _custom_ua ? params.userAgent : userAgent,
      webGLManufacturer: params.webGLInfo === 2 ? params.webGLManufacturer : webGLManufacturer, // 2 表示自定义 webgl 信息
      webGLRender: params.webGLInfo === 2 ? params.webGLRender : webGLRender,
    }
  })
  const { code, msg } = await API.window.userBatchWindowInfoV2Create(params)
  loading.value = false
  onlyErrorToast(code, msg)
  if (code === 0) {
    onBack()
    workspaceStore.getWorkspaceList()
    userStore.fetchUserInfo()
  }
}
</script>

<template>
  <div class="relative flex min-h-0 flex-1 flex-col overflow-hidden">
    <div class="px-16 flex flex-1 min-h-0 overflow-hidden overflow-x-auto">
      <div class="w-full h-full flex min-h-0 gap-8 ma-auto" :class="[collapsed ? 'min-w-192 max-w-192' : 'min-w-240 max-w-285']">
        <div class="flex min-h-0 min-w-0 flex-1 flex-col">
          <div class="mx-4 py-4 multiple">
            <div class="flex items-center justify-between">
              <div class="subtitle">
                {{ $t('窗口数量') }}
              </div>
              <RxInputNumber v-model="createCount" :min="1" :step="1" :max="maxWindowCount" class="!w-30" />
            </div>
            <div class="select-none multiple-tip">
              {{ $t('最多一次可批量创建 {maxWindowCount} 个', { maxWindowCount }) }}
            </div>
          </div>
          <AccordionInputs class="flex-1 min-h-0" :accordions="accordions" :inputs-group="inputsGroup">
            <template #before>
              <div class="flex items-center justify-between px-4 py-4">
                <div class="subtitle">
                  {{ $t('窗口信息') }}
                </div>
                <RxButton text severity="secondary" icon="base/rx_ic_template" :label="profileTemplate.label" @click.stop="showTemplates($event)" />
              </div>
            </template>
          </AccordionInputs>
          <div class="footer flex shrink-0 items-center justify-end gap-2 px-4 py-4 min-h-16">
            <MateGroup v-model="metaData" class="flex-1" />
            <SplitButton severity="secondary" :label="$t('存为新模板')" :model="items" @click.stop="saveTemplatePopup($event)" />
            <RxButton v-tooltip.top="canSubmit ? '' : $t('正在生成新指纹，请稍后')" class="guide2" :label="$t('创建窗口')" :disabled="!canSubmit" :loading="loading" @click.stop="createProfile()" />
          </div>
        </div>
        <PreviewCard v-model:collapsed="collapsed" :inputs-group="previewInputs" :is-batch="isBatch" :create-count="createCount" :is-import="false" :on-shuffle="shuffleFingerprint"
                     :choose-preset="choosePreset"
        />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
:deep(.p-splitbutton) {
  .p-button {
    padding: var(--spacing-md, 6px) 10px;
    font-size: var(--Font-Size-text-sm, 12px);
    line-height: var(--Line-Height-text-lg, 20px);
    border-width: 1px;

    &:not(:disabled):hover {
      border-width: 1px;
    }
  }

  .p-splitbutton-button {
    border-top-left-radius: var(--radius-md, 6px);
    border-bottom-left-radius: var(--radius-md, 6px);
    border-right-width: 0;
  }

  .p-splitbutton-dropdown {
    border-top-right-radius: var(--radius-md, 6px);
    border-bottom-right-radius: var(--radius-md, 6px);
    border-left-width: 0;
  }
}

.subtitle {
  color: var(--colors-text-text-primary);
  font-size: 16px;
  font-weight: 600;
}

.footer {
  border-top: 1px solid var(--colors-border-divider);

  :deep(.p-button) {
    max-width: 150px;
  }

  :deep(.p-button-label) {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

.multiple {
  border-bottom: 1px dashed var(--colors-border-divider-dashed);

  &-tip {
    margin-top: 4px;
    color: var(--colors-text-text-inactive);
    text-align: right;
    font-size: 12px;
  }
}
</style>
