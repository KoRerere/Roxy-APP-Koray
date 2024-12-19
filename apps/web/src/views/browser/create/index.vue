<script lang="tsx" setup>
import { useConfirm } from 'primevue/useconfirm'
import { useDialog } from 'primevue/usedialog'
import type { MetaData } from '/@/views/browser/create/components/type'
import { API } from '/@/api'
import { RxAlert } from '/@/components/rx-alert'
import rxEditDiv from '/@/components/rx-edit-div'
import { RxSvgIcon } from '/@/components/rx-icon/'
import RxInputSelect from '/@/components/ry-form/rx-input-select.vue'
import simplePopup from '/@/components/simplePopup'
import { Role } from '/@/enums'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { $t } from '/@/locales'
import { useWorkspaceStore } from '/@/stores/workspace'
import { deepClone, filterFieldByValue, getFormDataByList, isEmptyValue, setInputFieldByInputKey, setInputVisible } from '/@/utils'
import { useMateGroup } from '/@/views/browser/create/hooks/useMate'
import accordionInputs from './components/accordion-inputs.vue'
import importWindow from './components/import-window.vue'
import previewCard from './components/preview-card.vue'
import { ceateRandomFinger, getInputsGroup } from './form-inputs'
import { createTableContext } from './hooks/useContext'
import { getDefaultTemplate } from './utils'
import { getBackRoute } from '/@/router/utils'

interface TemplateMap {
  default: { [key: string]: any }
  [key: string]: { [key: string]: any }
}
interface TemplateOption {
  label: string
  value: string
  action: boolean
}

interface ProfileTemplate {
  value: string
  oldValue: string
  props: {
    options: TemplateOption[]
    optionValue: string
    filter: boolean
    onChange: () => void
  }
}

const confirm = useConfirm()
const dialog = useDialog()
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
const fileAnalyzeError = ref()
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

const templateMap = ref<TemplateMap>()

const profileTemplate = reactive<ProfileTemplate>({
  value: 'default',
  oldValue: 'default',
  props: {
    options: [
      { label: 'No Template', value: 'default', action: false },
    ],
    optionValue: 'value',
    filter: false,
    onChange: () => {
      if (profileTemplate.value === profileTemplate.oldValue)
        return
      profileTemplate.oldValue = profileTemplate.value
      const template = toRaw(templateMap.value![profileTemplate.value] || templateMap.value!.default)
      initFormInputs(template)
    },
  },
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

onBeforeMount(() => {
  getTemplateList()
  initFormInputs()
  if (!isOwner.value) {
    getProjects().then((operation) => {
      metaData.value.projectId = Number(operation[0].value)
      metaData.value.projectName = operation[0].label
    })
  }
})

async function getTemplateList() {
  const { data } = await API.window.userGetWindowTemplateListList()

  const defaultValue: any = {
    map: {
      default: getDefaultTemplate(),
    },
    options: [
      { label: $t('不使用模板'), value: 'default', action: false },
    ],
  }

  const { map, options } = data.reduce((acc, cur) => {
    if (cur.id) {
      const key = cur.id.toString()
      acc.map[key] = JSON.parse(cur.content)
      acc.options.push({ label: cur.templateName, value: key, action: true })
    }
    return acc
  }, defaultValue)

  templateMap.value = map
  profileTemplate.props.options = options
}

async function initFormInputs(template: any = {}) {
  const [inputsGroup, _original] = await getInputsGroup(template, showToast)
  const [windowInputs, basicInputs, highLevelInputs, otherInputs] = inputsGroup
  rawMainSetting.value = windowInputs.map((input: any) => deepClone(input))// 批量导入时 os, osVersion, coreVersion 使用默认值, 此处 copy 一份原始数据
  mainSetting.value = [windowInputs]
  extraSetting.value = [basicInputs, highLevelInputs, otherInputs]
  original.value = _original
  onUpdateFinger()
}

async function onShuffle() {
  await onUpdateFinger()
  showToast(0, $t('指纹刷新成功'))
}

async function onUpdateFinger() {
  const data = await ceateRandomFinger(previewInputs.value)
  Object.assign(original.value, data[0])
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

async function createProfile(openBrowser: boolean) {
  const _metaData = filterFieldByValue(toRaw(metaData.value) as object, v => !isEmptyValue(v))
  const formData = getFormDataByList(inputsGroup.value, _metaData)
  const params = {
    windowName: windowName.value,
    windowNamePrefix: windowName.value,
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
    const {path,query} = getBackRoute()
    console.log('onBack',path,query)
    router.replace({
      path,
      query: {
        ...query,
        title: metaData.value.projectName,
        browser: JSON.stringify({ windowId: data.windowId, openBrowser })
      }
    })
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
  const fingerDetail = await ceateRandomFinger(previewInputs.value, { count: createCount.value, preview: false })
  params.proxyInfoList = params.proxyInfoList.concat(Array.from({ length: diffCount }, () => ({ id: 0, proxyCategory: 'noproxy' })))// 代理数量小于创建数量补充为直连
  params.fingerDetail = fingerDetail
  const { code, msg } = await API.window.userBatchWindowInfoV2Create(params)
  loading.value = false
  showToast(code, msg)
  if (code === 0) {
    router.back()
  }
}

async function importProfile(params: any) {
  if (!fileAnalyzeData.value) {
    onlyErrorToast(-1, $t('请选择要导入的文件。'))
    return
  }
  loading.value = true
  const fingerCount = fileAnalyzeData.value.excelData.length
  const fingerDetail = await ceateRandomFinger(previewInputs.value, { count: fingerCount })
  const { code, msg } = await API.window.userImportWindowInfoV2Create({ ...params, ...fileAnalyzeData.value, fingerDetail, workspaceId: currentWorkspace?.id })
  loading.value = false
  if (code === 0) {
    router.back()
  }
  else {
    fileAnalyzeError.value = msg
  }
}
// ===========================================

const items = computed(() => [
  {
    label: $t('覆盖当前模板'),
    disabled: !!profileTemplate.value && profileTemplate.value === 'default',
    command: () => {
      const option = profileTemplate.props.options.find(item => item.value === profileTemplate.value)
      onSaveTemplate({ templateName: option!.label, id: Number(option!.value) })
    },
  },
])

async function saveTemplatePopup(option?: TemplateOption) {
  dialog.open(simplePopup, {
    props: {
      showHeader: false,
      modal: true,
      blockScroll: true,
    },
    data: {
      props: {
        title: option?.value ? $t('编辑模板') : $t('保存模板'),
        content: $t('请在以下文本框输入模板名称:'),
        inputs: [
          {
            type: 'text',
            name: 'templateName',
            placeholder: $t('模板名称'),
            value: option?.label,
            required: true,
          },
        ],
        render: () => <RxAlert class="!w-full" closable={false} type="info" title={$t('模板将不会保存代理，平台账号以及 cookies 信息')} />,
      },
      onConfirm: async (data: any) => {
        onSaveTemplate({ templateName: data.templateName, id: Number(option?.value) })
      },
    },
  })
}

async function onSaveTemplate({ templateName, id }: { templateName: string, id?: number }) {
  const formData = getFormDataByList(inputsGroup.value)
  const template = Object.keys(templateMap.value!.default).reduce((acc, cur) => {
    acc[cur] = formData[cur]
    return acc
  }, {} as any)

  const { code, msg } = id
    ? await API.window.userMdfWindowTemplateInfoCreate({ id, templateName, content: JSON.stringify(template) })
    : await API.window.userAddWindowTemplateInfoCreate({ templateName, content: JSON.stringify(template) })

  showToast(code, msg)
  if (code === 0) {
    getTemplateList()
  }
}

async function deleteTemplate(data: any) {
  confirm.require({
    header: $t('删除模板'),
    message: $t('您确认要删除 ({name}) 模板吗？', { name: data.label }),
    rejectProps: {
      label: $t('取消'),
      severity: 'secondary',
      outlined: true,
    },
    acceptProps: {
      label: $t('确认'),
      severity: 'danger',
    },
    accept: async () => {
      const { code, msg } = await API.window.userDeleteWindowTemplateInfoCreate({ id: Number(data.value) })
      showToast(code, msg)
      if (code === 0) {
        getTemplateList()
      }
    },
  })
}
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
          <div v-show="tabsValue !== 'import'" class="flex gap-2">
            <rxEditDiv v-model="windowName" class="flex-1" />
            <RxInputSelect v-model="profileTemplate.value" class="!w-42" v-bind="profileTemplate.props" name="template">
              <template #option-extra="{ option }">
                <div v-if="option.action" class="flex flex-1 justify-end gap-2">
                  <RxSvgIcon name="base/rx_ic_edit" @click.stop="saveTemplatePopup(option)" />
                  <RxSvgIcon name="base/rx_ic_bin_1" @click.stop="deleteTemplate(option)" />
                </div>
              </template>
            </RxInputSelect>
          </div>
          <div v-show="tabsValue === 'multi'" class="pl-2 multi-block">
            <div class="flex items-center justify-between">
              <div>{{ $t('窗口数量') }}</div>
              <InputNumber v-model="createCount" button-layout="horizontal" :min="1" :step="1" :max="maxWindowCount" show-buttons fluid>
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
            </div>
          </div>
          <import-window v-show="tabsValue === 'import'" v-model="fileAnalyzeError" @import-success="importSuccess" />
        </div>
        <accordionInputs v-model:metadata="metaData" class="flex-1" :accordions="accordions" :inputs-group="inputsGroup">
          <template #footer>
            <SplitButton v-if="tabsValue !== 'import'" severity="secondary" :label="$t('存为新模板')" :model="items" @click.stop="saveTemplatePopup()" />
            <!-- <RxButton v-if="tabsValue === 'single'" outlined severity="secondary" :label="$t('创建 & 打开')" @click.stop="createProfile(true)" /> -->
            <RxButton :label="$t('创建窗口')" @click.stop="createProfile(false)" />
          </template>
        </accordionInputs>
      </div>
    </div>
    <previewCard :inputs-group="previewInputs" :on-shuffle="onShuffle" />
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

    .p-tablist-active-bar {
      height: 2px;
    }
  }
}

.profile-basic {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-md, 16px);
  padding: var(--spacing-md, 16px) 66px;
}

.multi-block {
  color: var(--Component-Colors-TextInput-label-label, #171c1f);
  font-family: Inter;
  font-size: 13px;
  font-weight: 500;

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
    font-size: 12px;

    &-jump {
      color: var(--Colors-Text-text-brand, #12a3fc);
      cursor: pointer;
      user-select: none;
    }
  }
}

:deep(.p-splitbutton) {
  .p-button {
    padding: var(--spacing-md, 6px) 10px;
    font-size: var(--Font-Size-text-sm, 12px);
    line-height: var(--Line-Height-text-lg, 20px);
    border-width: 1px;
    // border-color: var(--Component-Colors-Buttons-Primary-border, #0881cc);

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
</style>
