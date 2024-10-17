<script lang="ts" setup>
import { API } from '/@/api'
import rxEditDiv from '/@/components/rx-edit-div'
import { RxSvgIcon } from '/@/components/rx-icon/'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { $t } from '/@/locales'
import { useWorkspaceStore } from '/@/stores/workspace'
import { deepClone, setInputFieldByInputKey, setInputVisible } from '/@/utils'
import accordionInputs from './components/accordion-inputs.vue'
import importWindow from './components/import-window.vue'
import previewCard from './components/preview-card.vue'
import { ceateRandomFinger, getInputsGroup } from './form-inputs'
import { createTableContext } from './hooks/useContext'

const router = useRouter()
const { currentWorkspace } = useWorkspaceStore()
const [showToast, onlyErrorToast] = useResponseToast()
const isBatch = ref(false)
const createCount = ref(1)
createTableContext({ isBatch, createCount })

const tabs = ref([
  { title: $t('Single Profiles'), value: 'single' },
  { title: $t('Multi Profiles'), value: 'batch' },
  { title: $t('Import Profiles'), value: 'import' },
])
const tabsValue = ref('single')
const windowName = ref('Untitled Profile')
const maxWindowCount = ref()
const fileAnalyzeData = ref()
const rawMainSetting: any = ref([])
const mainSetting: any = ref([])
const extraSetting: any = ref([])

const original = ref()

const inputsGroup = computed(() => {
  return tabsValue.value === 'import'
    ? [...extraSetting.value]
    : [...mainSetting.value, ...extraSetting.value]
})

const previewInputs = computed(() => {
  return tabsValue.value === 'import'
    ? [rawMainSetting.value, ...inputsGroup.value]
    : inputsGroup.value
})

const accordions = computed(() => {
  const startIndex = tabsValue.value === 'import' ? 1 : 0
  return {
    value: tabsValue.value === 'import' ? [] : ['0'],
    panels: ['window', 'Basic', 'highLevel', 'other'].slice(startIndex).map((title, index) => ({ title, value: (index + startIndex).toString() })),
  }
})

watch(() => tabsValue.value, (value: any) => {
  setInputVisible(inputsGroup.value[0], 'windowPlatformList', value === 'single')
  setInputFieldByInputKey(inputsGroup.value[0], 'proxyInfoList', 'value', [])
  isBatch.value = tabsValue.value === 'batch'
  if (isBatch.value) {
    getUserMaxCount()
  }
  onUpdateFinger()
})

function initFormInputs() {
  const [inputsGroup, _original] = getInputsGroup()
  const [windowInputs, basicInputs, highLevelInputs, otherInputs] = inputsGroup
  rawMainSetting.value = windowInputs.map((input: any) => deepClone(input))// 批量导入时 os, osVersion, coreVersion 使用默认值, 此处 copy 一份原始数据
  mainSetting.value = [windowInputs]
  extraSetting.value = [basicInputs, highLevelInputs, otherInputs]
  original.value = _original

  onUpdateFinger()
}

function onUpdateFinger() {
  ceateRandomFinger(previewInputs.value).then((data) => {
    Object.assign(original.value, data[0])
  })
}

async function getUserMaxCount() {
  try {
    const { data } = await API.base.userGetUserInfoList()
    maxWindowCount.value = Math.min(data.maxWindowCount, 100)
  }
  catch (error) {
    onlyErrorToast(-1, error as string)
  }
}

function importSuccess(data: any) {
  fileAnalyzeData.value = data
}

async function createProfile(formData: any, openBrowser: boolean) {
  const params = {
    windowName: windowName.value,
    createCount: createCount.value,
    ...original.value,
    ...formData,
  }
  switch (tabsValue.value) {
    case 'single':
      return singleCreateProfile(params, openBrowser)
    case 'batch':
      return batchCreateProfile(params)
    case 'import':
      return importProfile(params)
  }
}

async function singleCreateProfile(params: any, openBrowser: boolean) {
  const { code, data, msg } = await API.window.userAddWindowInfoV2Create(params)
  if (code === 0) {
    router.replace({ name: 'browser-list', query: { browser: JSON.stringify({ windowId: data.windowId, openBrowser }) } })
  }
  showToast(code, msg)
}

async function batchCreateProfile(params: any) {
  // 差异数量，代理总数量在 input 内的 formatValue 函数中有处理
  const diffCount = params.createCount - params.proxyInfoList.length
  if (diffCount < 0) {
    onlyErrorToast(-1, $t('The number of agents is greater than the number of profile'), 5000)
    return
  }

  const fingerDetail = await ceateRandomFinger(previewInputs.value, createCount.value)
  params.proxyInfoList = params.proxyInfoList.concat(Array.from({ length: diffCount }, () => ({ id: 0, proxyCategory: 'noproxy' })))// 代理数量小于创建数量补充为直连
  params.fingerDetail = fingerDetail
  await API.window.userBatchWindowInfoV2Create(params)
  router.replace({ name: 'browser-list' })
}

async function importProfile(params: any) {
  if (!fileAnalyzeData.value) {
    onlyErrorToast(-1, $t('Please select a file to import.'), 5000)
    return
  }
  const fingerCount = fileAnalyzeData.value.excelData.length
  const fingerDetail = await ceateRandomFinger(previewInputs.value, fingerCount)
  await API.window.userImportWindowInfoV2Create({ ...params, ...fileAnalyzeData.value, fingerDetail, workspaceId: currentWorkspace?.id })
  router.replace({ name: 'browser-list' })
}

onBeforeMount(() => {
  initFormInputs()
})
</script>

<template>
  <div class="flex justify-between h-full">
    <div class="flex flex-1 flex-col">
      <Tabs v-model:value="tabsValue">
        <TabList>
          <Tab v-for="tab in tabs" :key="tab.title" :value="tab.value">
            {{ tab.title }}
          </Tab>
        </TabList>
      </Tabs>
      <div class="flex-ovh-1 flex-col">
        <div class="top-content">
          <rxEditDiv v-show="tabsValue === 'single'" v-model="windowName" class="top-content-windown-name" />
          <div v-show="tabsValue === 'batch'" class="flex items-center justify-between batch">
            <div>Profiles amount</div>
            <div class="flex flex-col items-end">
              <InputNumber v-model="createCount" :min="1" :max="maxWindowCount" class="batch-input" show-buttons
                button-layout="horizontal" :step="1" fluid>
                <template #incrementicon>
                  <RxSvgIcon name="base/rx_ic_plus" />
                </template>
                <template #decrementicon>
                  <RxSvgIcon name="base/rx_ic_minus" />
                </template>
              </InputNumber>
              <div class="batch-info">
                Max profiles: {{ maxWindowCount }}. For more profiles please <span class="batch-info-jump"
                  @click="tabsValue = 'import'">import
                  profiles</span>.
              </div>
            </div>
          </div>
          <import-window v-show="tabsValue === 'import'" @import-success="importSuccess" />
        </div>
        <accordionInputs class="flex-1" :accordions="accordions" :inputs-group="inputsGroup"
          :open-browser="tabsValue === 'single'" @create-open="(formData: any) => createProfile(formData, true)"
          @create="(formData: any) => createProfile(formData, false)" />
      </div>
    </div>
    <previewCard :inputs-group="previewInputs" @shuffle="onUpdateFinger" />
  </div>
</template>

<style lang="scss" scoped>
.top-content {
  padding: var(--spacing-md, 16px) var(--spacing-sm, 12px);

  &-windown-name {
    padding: var(--spacing-md, 6px) 8px;
  }
}

.batch {
  padding: var(--spacing-none, 0px) 8px;

  &-input {
    margin-bottom: var(--spacing-xs, 4px);
    width: 150px;

    :deep(.p-inputnumber-input) {
      text-align: center;
    }
  }

  &-info {
    color: var(--Colors-Text-text-tertiary, #7c8387);
    text-align: right;
    font-family: Inter;
    font-size: 10px;
    font-style: normal;
    font-weight: 400;
    line-height: normal;

    &-jump {
      color: var(--Colors-Text-text-brand, #12a3fc);
      cursor: pointer;
      user-select: none;
    }
  }
}
</style>
