<script lang="ts" setup>
import type { MetaData } from '/@/views/browser/create/components/type'
import { API } from '/@/api'
import rxEditDiv from '/@/components/rx-edit-div'
import { RxSvgIcon } from '/@/components/rx-icon/'
import { Role } from '/@/enums'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { $t } from '/@/locales'
import { useWorkspaceStore } from '/@/stores/workspace'
import { deepClone, setInputFieldByInputKey, setInputVisible } from '/@/utils'
import { useMateGroup } from '/@/views/browser/create/hooks/useMate'
import accordionInputs from './components/accordion-inputs.vue'
import importWindow from './components/import-window.vue'
import previewCard from './components/preview-card.vue'
import { ceateRandomFinger, getInputsGroup } from './form-inputs'
import { createTableContext } from './hooks/useContext'

const router = useRouter()
const { currentWorkspace } = useWorkspaceStore()
const [showToast, onlyErrorToast] = useResponseToast()
const { getProjects } = useMateGroup()

const isBatch = ref(false)
const createCount = ref(1)
createTableContext({ isBatch, createCount })

const tabs = ref([
  { title: $t('单个创建'), value: 'single' },
  { title: $t('批量创建'), value: 'multi' },
  { title: $t('窗口导入'), value: 'import' },
])
const tabsValue = ref('single')
const windowName = ref($t('未命名窗口'))
const maxWindowCount = ref()
const fileAnalyzeData = ref()
const rawMainSetting: any = ref([])
const mainSetting: any = ref([])
const extraSetting: any = ref([])
const original = ref()
const metaData = ref<MetaData>({
  projectName: $t('未指定项目'),
  projectId: undefined,
  labelIds: [],
  windowRemark: '',
})
const loading = ref(false)

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
    panels: [$t('窗口信息'), $t('基础设置'), $t('高级指纹设置'), $t('偏好设置')].slice(startIndex).map((title, index) => ({ title, value: (index + startIndex).toString() })),
  }
})

const isOwner = computed(() => currentWorkspace?.role === Role.OWNER)

watch(() => tabsValue.value, (value: any) => {
  setInputVisible(inputsGroup.value[0], 'windowPlatformList', value === 'single')
  setInputFieldByInputKey(inputsGroup.value[0], 'proxyInfoList', 'value', [])
  isBatch.value = tabsValue.value === 'multi'
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
    case 'multi':
      return batchCreateProfile(params)
    case 'import':
      return importProfile(params)
  }
}

async function singleCreateProfile(params: any, openBrowser: boolean) {
  loading.value = true
  const { code, data, msg } = await API.window.userAddWindowInfoV2Create(params)
  if (code === 0) {
    router.replace({ name: 'browser-list', query: { browser: JSON.stringify({ windowId: data.windowId, openBrowser }) } })
  }
  showToast(code, msg)
  loading.value = false
}

async function batchCreateProfile(params: any) {
  // 差异数量，代理总数量在 input 内的 formatValue 函数中有处理
  const diffCount = params.createCount - params.proxyInfoList.length
  if (diffCount < 0) {
    onlyErrorToast(-1, $t('代理数量不能大于窗口'))
    return
  }

  loading.value = true
  const fingerDetail = await ceateRandomFinger(previewInputs.value, createCount.value)
  params.proxyInfoList = params.proxyInfoList.concat(Array.from({ length: diffCount }, () => ({ id: 0, proxyCategory: 'noproxy' })))// 代理数量小于创建数量补充为直连
  params.fingerDetail = fingerDetail
  await API.window.userBatchWindowInfoV2Create(params)
  router.replace({ name: 'browser-list' })
  loading.value = false
}

async function importProfile(params: any) {
  if (!fileAnalyzeData.value) {
    onlyErrorToast(-1, $t('请选择要导入的文件。'))
    return
  }
  loading.value = true
  const fingerCount = fileAnalyzeData.value.excelData.length
  const fingerDetail = await ceateRandomFinger(previewInputs.value, fingerCount)
  await API.window.userImportWindowInfoV2Create({ ...params, ...fileAnalyzeData.value, fingerDetail, workspaceId: currentWorkspace?.id })
  router.replace({ name: 'browser-list' })
  loading.value = false
}

onBeforeMount(() => {
  initFormInputs()
  if (!isOwner.value) {
    getProjects().then((operation) => {
      metaData.value.projectId = Number(operation[0].value)
      metaData.value.projectName = operation[0].label
    })
  }
})
</script>

<template>
  <div class="flex justify-between h-full">
    <div class="flex flex-1 flex-col">
      <ViewsHeader show-back :title="$t('创建窗口')" />
      <div class="profile-tabs">
        <Tabs v-model:value="tabsValue">
          <TabList>
            <Tab v-for="tab in tabs" :key="tab.title" :value="tab.value">
              {{ tab.title }}
            </Tab>
          </TabList>
        </Tabs>
      </div>
      <div class="flex-ovh-1 flex-col">
        <div class="profile-basic">
          <rxEditDiv v-show="tabsValue === 'single'" v-model="windowName" />
          <div v-show="tabsValue === 'multi'" class="multi-block">
            <div class="flex items-center justify-between">
              <div>{{ $t('窗口数量') }}</div>
              <InputNumber v-model="createCount" class="multi-block-input" button-layout="horizontal" :min="1" :step="1" :max="maxWindowCount" show-buttons fluid>
                <template #incrementicon>
                  <RxSvgIcon name="base/rx_ic_plus" />
                </template>
                <template #decrementicon>
                  <RxSvgIcon name="base/rx_ic_minus" />
                </template>
              </InputNumber>
            </div>
            <div class="multi-block-info">
              {{ $t('最多一次可批量创建 {maxWindowCount} 个', { maxWindowCount }) }}
              <!-- <i18n-t :keypath="$t('最多一次可批量创建: {maxWindowCount}. 更多窗口请使用 {importProfiles}.', { maxWindowCount, importProfiles: '{importProfiles}' })" scope="global">
                <template #importProfiles>
                  <span class="multi-block-info-jump" @click="tabsValue = 'import'">{{ $t('窗口导入') }}</span>
                </template>
              </i18n-t> -->
            </div>
          </div>
          <import-window v-show="tabsValue === 'import'" @import-success="importSuccess" />
        </div>
        <accordionInputs v-model:metadata="metaData" v-model:loading="loading" class="flex-1" :accordions="accordions" :inputs-group="inputsGroup" :open-browser="tabsValue === 'single'"
          @create-open="createProfile($event, true)" @create="createProfile($event, false)" />
      </div>
    </div>
    <previewCard :inputs-group="previewInputs" @shuffle="onUpdateFinger" />
  </div>
</template>

<style lang="scss" scoped>
.profile-tabs {
  padding: 0px var(--spacing-4xl, 24px);
  border-bottom: 0.5px solid var(--Colors-Border-border-container, #c7cdd1);

  :deep(.p-tablist-tab-list) {
    gap: var(--spacing-2xl, 16px);
    border-color: transparent;

    .p-tab {
      padding: var(--spacing-md, 6px) var(--spacing-lg, 8px);
      color: var(--Colors-Text-text-secondary, #575d61);
      font-family: Inter;
      font-size: var(--Font-Size-text-sm, 12px);
      font-weight: 500;
      line-height: var(--Line-Height-text-xs, 16px);
      border-color: transparent;

      &:not(.p-tab-active):not(.p-disabled):hover {
        border-color: transparent;
      }
    }

    .p-tab-active {
      color: var(--Colors-Text-text-brand, #12a3fc);
    }
  }
}

.profile-basic {
  padding: var(--spacing-md, 16px) 66px;
}

.multi-block {
  padding: 0 var(--spacing-lg, 8px);
  color: var(--Color-neutrals-900, #171c1f);
  font-family: Inter;
  font-size: 14px;
  font-weight: 600;
  line-height: normal;

  :deep(.p-inputnumber) {
    width: 120px;

    border-radius: var(--Component-Colors-TextInput-radius-radius-md, 6px);
    border: 1px solid var(--Component-Colors-TextInput-border-border, #c7cdd1);
    background: var(--Component-Colors-TextInput-bg-bg, #fff);

    .p-inputnumber-input {
      padding: 0;
      border: none;
      color: var(--Component-Colors-TextInput-text-text, #171c1f);
      text-align: center;
      font-family: Inter;
      font-size: 12px;
      line-height: var(--Line-Height-text-lg, 20px);
    }

    .p-inputnumber-button {
      padding: var(--spacing-md, 6px);
      width: auto;
      border: none;
    }
  }

  &-info {
    margin-top: var(--spacing-xs, 4px);
    color: var(--Colors-Text-text-tertiary, #7c8387);
    text-align: right;
    font-size: 10px;

    &-jump {
      color: var(--Colors-Text-text-brand, #12a3fc);
      cursor: pointer;
      user-select: none;
    }
  }
}
</style>
