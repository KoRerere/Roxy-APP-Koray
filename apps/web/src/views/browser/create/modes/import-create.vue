<script lang="tsx" setup>
import type { CreatePageShared } from './useCreatePageShared'
import MateGroup from '../components/mate-group.vue'
import AccordionInputs from '../components/accordion-inputs.vue'
import ImportWindow from '../components/import-window.vue'
import PreviewCard from '../components/preview-card.vue'
import RxButton from '/@/components/rx-button'
import RxLoading from '/@/components/rx-loading.vue'
import { API } from '/@/api'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { useDialog } from '/@/hooks/useDialog'
import { CoreType } from '/@/enums'
import { getDictMap, getFormDataByList } from '/@/utils'
import { createDefaultWindowAccordions } from './createDefaultAccordions'

const props = defineProps<{
  shared: CreatePageShared
}>()

const [showModal] = useDialog()
const [showToast, onlyErrorToast] = useResponseToast()

const accordions = ref(createDefaultWindowAccordions())
const fileAnalyzeData = ref()
const fileAnalyzeError = ref()

const {
  collapsed,
  inputsGroup,
  previewInputs,
  isBatch,
  createCount,
  shuffleFingerprint,
  choosePreset,
  metaData,
  canSubmit,
  loading,
  formGate,
  clearDriver,
  prepareCreateParams,
  onBack,
  workspaceStore,
  userStore,
} = props.shared

const { currentWorkspace } = storeToRefs(workspaceStore)

function importSuccess(data: any) {
  fileAnalyzeData.value = data
}

async function createProfile() {
  await formGate.waitUntilReady()
  clearDriver()
  const params = await prepareCreateParams({
    inputs: inputsGroup.value,
    metadata: metaData.value,
    createCount: createCount.value,
  })
  return importProfile(params)
}

async function importProfile(params: any) {
  if (fileAnalyzeError.value) {
    onlyErrorToast(-1, fileAnalyzeError.value)
    return
  }
  if (!fileAnalyzeData.value) {
    onlyErrorToast(-1, $t('请选择要导入的文件。'))
    return
  }
  loading.value = true
  const modal = showLoading()
  const { excelData } = fileAnalyzeData.value

  // 读取表单的公共指纹参数（字体、canvas 等与内核无关的项作为基准值）
  const { fontType, canvas, webGL, audioContext, speechVoices, clientRects, macInfo, os, osVersion } = getFormDataByList(previewInputs.value)

  // 从字典获取各内核类型的最新版本，用于行内 coreVersion 为空时的回退
  const $dict_map = await getDictMap()
  const latestChromeVersion: string = $dict_map.coreVersion?.[0]?.value ?? ''
  const latestFirefoxVersion: string = $dict_map.firefoxCoreVersion?.[0]?.value ?? ''

  // 按「coreType + coreVersion」组合分组，并记录每行的原始索引
  // 目的：不同 coreType/coreVersion 组合需分别调用指纹生成接口，同时保证回填后顺序与导入顺序一致
  const coreTypeGroups = new Map<string, { coreType: string, coreVersion: string, indices: number[] }>()
  excelData.forEach((row: any, index: number) => {
    const rowCoreType: string = row.coreType || CoreType.Chrome
    // 行内 coreVersion 为空时，按内核类型回退到对应的最新版本
    const fallbackVersion = rowCoreType === CoreType.Firefox ? latestFirefoxVersion : latestChromeVersion
    const rowCoreVersion: string = row.coreVersion || fallbackVersion
    const groupKey = `${rowCoreType}:${rowCoreVersion}`
    if (!coreTypeGroups.has(groupKey))
      coreTypeGroups.set(groupKey, { coreType: rowCoreType, coreVersion: rowCoreVersion, indices: [] })
    coreTypeGroups.get(groupKey)!.indices.push(index)
  })

  // 并行为各 coreType+coreVersion 组批量生成指纹，再按原始索引回填，确保最终顺序与导入顺序相同
  const rawFingerDetail: any[] = Array.from({ length: excelData.length })
  await Promise.all(
    Array.from(coreTypeGroups.values()).map(async ({ coreType: rowCoreType, coreVersion: rowCoreVersion, indices }) => {
      const fingers = await globalThis.electronAPI.send('util:genRandomFingerprint', {
        fontType,
        canvas,
        webGL,
        audioContext,
        speechVoices,
        clientRects,
        macInfo,
        os,
        osVersion,
        coreVersion: rowCoreVersion, // 使用该行自身的 coreVersion
        coreType: rowCoreType, // 使用该行自身的 coreType 生成对应指纹
      }, indices.length)
      // 将生成结果按原始行索引回填，保证顺序
      indices.forEach((origIndex, i) => {
        rawFingerDetail[origIndex] = fingers[i]
      })
    }),
  ).catch((error) => {
    console.error('[ImportCreate] fingerprint generation failed:', error)
    loading.value = false
    modal.hideModal()
    onlyErrorToast(-1, $t('指纹生成失败，请检查输入的参数是否正确'))
    return Promise.reject(new Error('fingerprint generation failed'))
  })

  const fingerDetail = rawFingerDetail.map(({ webGLManufacturer, webGLRender, ...item }: any) => {
    return {
      ...item,
      webGLManufacturer: params.webGLInfo === 2 ? params.webGLManufacturer : webGLManufacturer, // 2 表示自定义 webgl 信息
      webGLRender: params.webGLInfo === 2 ? params.webGLRender : webGLRender,
    }
  })
  const { code, msg } = await API.window.userImportWindowInfoV2Create({
    ...params,
    ...fileAnalyzeData.value,
    workspaceId: currentWorkspace.value?.id,
    fingerDetail,
  })
  loading.value = false
  modal.hideModal()
  if (code === 0) {
    showToast(0, msg)
    onBack()
    workspaceStore.getWorkspaceList()
    userStore.fetchUserInfo()
  }
  else {
    fileAnalyzeError.value = Array.isArray(msg) ? msg.join('\n') : msg
  }
}

function showLoading() {
  return showModal({
    showHeader: false,
    modal: true,
    blockScroll: true,
    closeOnEscape: false,
    pt: {
      root: '!border-none !shadow-none rounded-lg',
    },
    slots: {
      container: () => (
        <div class="flex flex-col justify-center items-center gap-6 w-60 h-37">
          <div class="relative w-8 h-8">
            <RxLoading modelValue={true} opacity={0.9}></RxLoading>
          </div>
          <div>{$t('创建中...')}</div>
        </div>
      ),
    },
  })
}
</script>

<template>
  <div class="relative flex min-h-0 flex-1 flex-col overflow-hidden">
    <div class="px-16 flex flex-1 min-h-0 overflow-hidden overflow-x-auto">
      <div class="w-full h-full flex min-h-0 gap-8 ma-auto" :class="[collapsed ? 'min-w-192 max-w-192' : 'min-w-240 max-w-285']">
        <div class="flex min-h-0 min-w-0 flex-1 flex-col">
          <AccordionInputs class="flex-1 min-h-0" :accordions="accordions" :inputs-group="inputsGroup">
            <template #before>
              <ImportWindow v-model:error="fileAnalyzeError" class="pt-4" @import-success="importSuccess" />
            </template>
          </AccordionInputs>
          <div class="footer flex shrink-0 items-center justify-end gap-2 px-4 py-4 min-h-16">
            <MateGroup v-model="metaData" class="flex-1" :show-remark="false" />
            <RxButton v-tooltip.top="canSubmit ? '' : $t('正在生成新指纹，请稍后')" class="guide2" :label="$t('创建窗口')" :disabled="!canSubmit" :loading="loading" @click.stop="createProfile()" />
          </div>
        </div>
        <PreviewCard v-model:collapsed="collapsed" :inputs-group="previewInputs" :is-batch="isBatch" :create-count="createCount" :is-import="true" :on-shuffle="shuffleFingerprint"
                     :choose-preset="choosePreset"
        />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
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
</style>
