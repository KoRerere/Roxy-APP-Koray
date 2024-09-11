<script lang="ts" setup>
import { useToast } from 'primevue/usetoast'
import accordionInputs from './components/accordion-inputs.vue'
import importWindow from './components/import-window.vue'
import previewCard from './components/preview-card.vue'
import { ceateRandomFinger, getDefaultValue, getInputsGroup } from './form-inputs'
import { createTableContext } from './hooks/useContext'
import { API } from '/@/api'
import rxEditDiv from '/@/components/rx-edit-div'
import { deepClone, getFormDataByList, setInputFieldByInputKey, setInputVisible } from '/@/utils'

const router = useRouter()
const toast = useToast()

const tabs = ref([
  { title: '单个创建', value: 'single' },
  { title: '批量创建', value: 'batch' },
  { title: '批量导入', value: 'import' },
])
const tabsValue = ref('single')
const isBatch = ref(false)

const windowName = ref('Untitled profile')
const createCount = ref(1)
const maxWindowCount = ref()
const fileAnalyzeData = ref()
createTableContext({ isBatch, createCount })

const [windowInputs, basicInputs, highLevelInputs, otherInputs] = getInputsGroup()
/**
 *批量导入时 os,osVersion,coreVersion 使用默认值, 此处copy一份原始数据
 */
const original = ref(getDefaultValue())
const rawWindowInputs = ref(windowInputs.map((input: any) => deepClone(input)))

const inputsGroup = computed(() => {
  return tabsValue.value === 'import'
    ? [basicInputs, highLevelInputs, otherInputs]
    : [windowInputs, basicInputs, highLevelInputs, otherInputs]
})
const accordions = computed(() => {
  const startIndex = tabsValue.value === 'import' ? 1 : 0
  return {
    value: tabsValue.value === 'import' ? [] : ['0'],
    panels: ['window', 'Basic', 'highLevel', 'other'].slice(startIndex).map((title, index) => ({ title, value: (index + startIndex).toString() })),
  }
})
const previewInputs = computed(() => {
  return tabsValue.value === 'import'
    ? [rawWindowInputs.value, ...inputsGroup.value]
    : inputsGroup.value
})
const previewData = computed(() => {
  return getFormDataByList(previewInputs.value, {}, { keyName: 'label', valueName: 'value' })
})

watch(() => tabsValue.value, (value) => {
  setInputVisible(inputsGroup.value[0], 'windowPlatformList', value === 'single')
  setInputFieldByInputKey(inputsGroup.value[0], 'proxyInfoList', 'value', [])
  isBatch.value = tabsValue.value === 'batch'
  if (isBatch.value) {
    getUserInfo()
  }
  ceateRandomFinger(previewInputs.value)
})

async function getUserInfo() {
  try {
    const { data } = await API.base.userGetUserInfoList()
    maxWindowCount.value = Math.min(data.maxWindowCount, 100)
  }
  catch (error) {
    console.log('🚀 ~ getUserInfo ~ error:', error)
  }
}

function importSuccess(data: any) {
  fileAnalyzeData.value = data
}

function onShuffle() {
  ceateRandomFinger(previewInputs.value)
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
  const { data } = await API.window.userAddWindowInfoCreate(params)
  router.replace({ name: 'browser-list', query: { browser: JSON.stringify({ windowId: data.windowId, openBrowser }) } })
}

async function batchCreateProfile(params: any) {
  // 差异数量，代理总数量在formData时已处理
  const diffCount = params.createCount - params.proxyInfoList.length
  if (diffCount < 0) {
    toast.add({ severity: 'error', summary: '错误', detail: '代理数量不能大于创建窗口数量', group: 'tc', life: 5000 })
    return
  }

  const fingerDetail = await ceateRandomFinger(previewInputs.value, createCount.value)
  params.proxyInfoList = params.proxyInfoList.concat(Array.from({ length: diffCount }, () => ({ id: 0, proxyCategory: 'noproxy' })))// 代理数量小于创建数量补充为直连
  params.fingerDetail = fingerDetail
  await API.window.userBatchWindowInfoCreate(params)
  router.replace({ name: 'browser-list' })
}

async function importProfile(params: any) {
  if (!fileAnalyzeData.value) {
    toast.add({ severity: 'error', summary: 'Error', detail: 'Please select a file to import.' })
    return
  }
  const fingerCount = fileAnalyzeData.value.excelData.length
  const fingerDetail = await ceateRandomFinger(previewInputs.value, fingerCount)
  await API.window.userImportWindowInfoV2Create({ ...params, ...fileAnalyzeData.value, fingerDetail })
  router.replace({ name: 'browser-list' })
}

function cancel() {
  router.back()
}

onMounted(() => {
  ceateRandomFinger(inputsGroup.value)
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
      <div class="flex-ovh-1">
        <Accordion class="w-45 metadata" value="0">
          <AccordionPanel value="0">
            <AccordionHeader as="div" class="metadata-header">
              Header I
            </AccordionHeader>
            <AccordionContent>
              <div class="metadata-list">
                <div v-for="item in ['Group', 'Tag', 'Notes']" :key="item" class="metadata-list-item">
                  <span class="mdi mdi-information-outline" />
                  <span class="flex-1">{{ item }}</span>
                  <span class="mdi mdi-plus" />
                </div>
              </div>
            </AccordionContent>
          </AccordionPanel>
        </Accordion>
        <div class="flex-ovh-1 flex-col content-scvr">
          <div class="top-content">
            <rxEditDiv v-show="tabsValue === 'single'" v-model="windowName" class="top-content-windown-name" />
            <div v-show="tabsValue === 'batch'" class="flex items-center justify-between batch">
              <div>Profiles amount</div>
              <div class="flex flex-col items-end">
                <InputNumber v-model="createCount" :max="maxWindowCount" class="batch-input" show-buttons
                  button-layout="horizontal" :step="1" fluid>
                  <template #incrementicon>
                    <span class="mdi mdi-plus" />
                  </template>
                  <template #decrementicon>
                    <span class="mdi mdi-minus" />
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
            :open-browser="tabsValue === 'single'" @cancel="cancel"
            @create-open="(formData: any) => createProfile(formData, true)"
            @create="(formData: any) => createProfile(formData, false)" />
        </div>
      </div>
    </div>
    <previewCard :data="previewData" @shuffle="onShuffle" />
  </div>
</template>

<style lang="scss" scoped>
.top-content {
  padding: var(--spacing-md, 16px) var(--spacing-sm, 12px);

  &-windown-name {
    padding: var(--spacing-md, 6px) 8px;
  }
}

.metadata {
  margin-top: 63px;
  padding: 0 16px;

  :deep(.p-accordionpanel) {
    border: none;
  }

  :deep(.p-accordioncontent-content) {
    padding: 16px 8px;
  }

  &-header {
    padding: var(--spacing-md, 6px) 8px;
    background: var(--Color-neutrals-100, #f0f3f5) !important;
    border-radius: 4px;
  }

  &-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-4xl, 24px);

    &-item {
      display: flex;
      align-items: center;
      align-self: stretch;
      gap: var(--spacing-md, 6px);
    }
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
