<script lang="tsx" setup>
import MateGroup from './components/mate-group.vue'
import AccordionInputs from './components/accordion-inputs.vue'
import ImportWindow from './components/import-window.vue'
import PreviewCard from './components/preview-card.vue'
import RxButton from '/@/components/rx-button'
import RxLoading from '/@/components/rx-loading.vue'
import { RxSvgIcon } from '/@/components/rx-icon'
import { RxInputNumber } from '/@/components/rx-input-number'
import { useConfirm } from 'primevue/useconfirm'
import { I18nT } from 'vue-i18n'
import { API } from '/@/api'
import { useSimpleDialog } from '/@/components/simplePopup'
import { usePopupMenu } from '/@/hooks/usePopupMenu'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { useDialog } from '/@/hooks/useDialog'
import { usePermission } from '/@/hooks/usePermission'
import { useBackRoute } from '/@/router/utils'
import { useUserStore } from '/@/stores/user'
import { useWorkspaceStore } from '/@/stores/workspace'
import { ceateRandomFinger, getInputsGroup, switchMoblieInputVisible } from './form-inputs'
import { createTableContext } from './hooks/useContext'
import { getDefaultTemplate } from './utils'
import { switchWorkspaceAndToUpgradePlan, useHandleBusinessCode } from '/@/hooks/useResponseToast/handleBusinessCode'
import { deepClone, filterFieldByValue, filterInputsByNames, findInputByName, genDriver, getFormDataByList, isEmptyValue, setInputValue } from '/@/utils'
import { emitter } from '/@/utils/eventBus'
import { withModifiers } from 'vue'
import { AccountBindType } from '/@/enums/account'
import type { WindowMetaData } from '/@/views/browser/create/components/type'

const route = useRoute()
const confirm = useConfirm()
const router = useRouter()
const workspaceStore = useWorkspaceStore()
const userStore = useUserStore()
const backRoute = useBackRoute()
const { userPayInfo } = storeToRefs(userStore)
const { currentWorkspace } = storeToRefs(workspaceStore)
const { handleBusinessCode } = useHandleBusinessCode()
const { showSimpleDialog } = useSimpleDialog()
const { showMenu } = usePopupMenu()
const [showModal] = useDialog()
const [showToast, onlyErrorToast] = useResponseToast()
const { check } = usePermission()

const isBatch = ref(false)
const createCount = ref(1)
const driverObj = ref()
createTableContext({ isBatch, createCount, driverObj })

const tabs = [
  { title: $t('单个创建'), value: 'single' },
  { title: $t('批量创建'), value: 'multiple' },
  { title: $t('窗口导入'), value: 'import' },
]
const tabsValue = ref(tabs[0]!.value)
const fileAnalyzeData = ref()
const fileAnalyzeError = ref()
const rawMainSetting = ref<any[]>([])
const mainSetting = ref<any[]>([])
const extraSettings = ref<any[][]>([])
const original = ref()
const metaData = ref<WindowMetaData>({
  projectName: $t('未指定项目'),
  projectId: undefined,
  labelIds: [],
  windowRemark: '',
})
const loading = ref(false)
const collapsed = ref(false)

const accordions = ref({
  value: [],
  panels: [$t('基础设置'), $t('高级指纹设置'), $t('偏好设置')]
    .map((title, index) => ({ title, value: index.toString() })),
})

const templateMap = ref<Record<string, any>>()
const templateModel = ref<any[]>([])
const profileTemplate = reactive({
  value: 'default',
  oldValue: 'default',
  label: $t('不使用模板'),
  select: () => {
    if (profileTemplate.value === profileTemplate.oldValue)
      return
    profileTemplate.oldValue = profileTemplate.value
    const template = toRaw(templateMap.value![profileTemplate.value] || templateMap.value!.default)
    initFormInputs(template)
  },
})

const cachesMap = { proxyInfoList: [], windowPlatformList: [] }
const tempCache = ref<Record<string, any[]>>({})

const items = computed(() => [
  {
    label: $t('覆盖当前模板'),
    disabled: !!profileTemplate.value && profileTemplate.value === 'default',
    command: () => {
      const option = templateModel.value.find(item => item.value === profileTemplate.value)
      onSaveTemplate({ templateName: option!.label, id: Number(option!.value) })
    },
  },
])

const maxWindowCount = computed(() => Math.min(userPayInfo.value.maxWindowCount - userPayInfo.value.useWindowCount, 100))

const inputsGroup = computed(() => {
  return tabsValue.value === 'import'
    ? [[], ...extraSettings.value]
    : [mainSetting.value, ...extraSettings.value]
})

const previewInputs = computed(() => {
  return tabsValue.value === 'import'
    ? [rawMainSetting.value, ...extraSettings.value]
    : [mainSetting.value, ...extraSettings.value]
})

watch(() => tabsValue.value, (value, oldValue) => {
  isBatch.value = value === 'multiple'

  if (oldValue !== 'import') {
    const cache = filterInputsByNames(inputsGroup.value[0]!, Object.keys(cachesMap)).map(item => [item.name, deepClone(item.value)])
    Reflect.set(tempCache.value, oldValue, cache)
  }

  if (value !== 'import') {
    (tempCache.value[value] ?? Object.entries(cachesMap)).forEach(([name, value]) => {
      setInputValue(inputsGroup.value[0]!, name, value)
    })
  }
  showMobileExtraSettings()
  onUpdateFinger()
})

onBeforeMount(() => {
  getTemplateList()
  initFormInputs()
})

async function getTemplateList() {
  const { data } = await API.window.userGetWindowTemplateListList()
  const defaultTemplate = await getDefaultTemplate()

  const defaultValue: { map: Record<string, any>, options: any[] } = {
    map: {
      default: defaultTemplate,
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
  templateModel.value = options.map((item) => {
    return {
      ...item,
      command: () => {
        profileTemplate.value = item.value
        profileTemplate.label = item.label
        profileTemplate.select()
      },
      render: ({ item, btnPt }: any) => {
        return (
          <RxButton text severity="secondary" class="w-full" pt={btnPt}>
            <div class="w-full flex items-center gap-2">
              <div class="flex-1 text-left">{item.label}</div>
              {
                item.action && (
                  <>
                    <div onClick={withModifiers(event => saveTemplatePopup(event, item), ['stop'])}>
                      <RxSvgIcon name="base/rx_ic_edit" />
                    </div>
                    <div onClick={withModifiers(() => deleteTemplate(item), ['stop'])}>
                      <RxSvgIcon name="base/rx_ic_bin_1" />
                    </div>
                  </>
                )
              }
            </div>
          </RxButton>
        )
      },
    }
  })
}

async function initFormInputs(template: Record<string, any> = {}) {
  const [inputsGroup, _original] = await getInputsGroup(template, showToast)
  const [windowInputs, basicInputs, highLevelInputs, otherInputs] = inputsGroup
  rawMainSetting.value = windowInputs.map((input: any) => deepClone(input))// 批量导入时 os, osVersion, coreVersion 使用默认值, 此处 copy 一份原始数据
  mainSetting.value = windowInputs
  extraSettings.value = [basicInputs, highLevelInputs, otherInputs]
  original.value = _original
  onUpdateFinger()

  if (route.query.driver) {
    nextTick(() => {
      showGuide()
    })
  }
}

function showGuide() {
  driverObj.value = genDriver({
    showProgress: false,
    disableActiveInteraction: false,
    allowClose: true,
    showButtons: ['close'],
    overlayClickBehavior: (_, __, opts) => {
      opts.driver.destroy()
      driverObj.value = undefined
    },
    onDestroyed: () => {
      clearGuide1Highlight()
    },
    steps: [
      {
        element: '.guide1',
        popover: { description: $t('此处展示的是您当前的 IP 地址。'), side: 'top', align: 'center' },
        onHighlightStarted: () => {
          nextTick(() => {
            requestAnimationFrame(() => {
              const root = document.querySelector('.guide1')
              if (!root)
                return
              const n = root.querySelectorAll('.guide1-pulse-target').length
              highlightGuide1Targets(Array.from({ length: n }, (_, i) => i))
            })
          })
        },
        onDeselected: () => {
          clearGuide1Highlight()
        },
      },
      { element: '.guide2', popover: { description: $t('单击此处即可完成创建。'), side: 'top', align: 'end' } },
    ],
  })
  driverObj.value.drive()
}

function clearDriver() {
  if (driverObj.value) {
    driverObj.value.destroy()
    driverObj.value = undefined
  }
}

function highlightGuide1Targets(indexes: number[]) {
  const root = document.querySelector('.guide1')
  if (!root)
    return
  const targets = root.querySelectorAll('.guide1-pulse-target')
  targets.forEach((el, i) => {
    if (indexes.includes(i))
      el.classList.add('guide1-pulse-active')
  })
}

function clearGuide1Highlight() {
  document.querySelectorAll('.guide1 .guide1-pulse-active').forEach(el => el.classList.remove('guide1-pulse-active'))
}

function showMobileExtraSettings() {
  if (tabsValue.value === 'import') {
    switchMoblieInputVisible(extraSettings.value, true)
  }
  else {
    const input = findInputByName(mainSetting.value, 'os')
    const moblieVisible = ['Android', 'IOS'].includes(input.value.value)
    switchMoblieInputVisible(extraSettings.value, moblieVisible)
  }
}

async function onShuffle() {
  await onUpdateFinger()
  showToast(0, $t('指纹刷新成功'))
}

async function onUpdateFinger() {
  const data = await ceateRandomFinger(previewInputs.value)
  Object.assign(original.value, data[0])
}

function showTemplates(event: MouseEvent) {
  showMenu(event, { model: templateModel.value })
}

async function saveTemplatePopup(event: Event, option?: Record<string, any>) {
  const { code } = await API.pay.userCheckTeamUserRightsList()
  if (code !== 0) {
    if (!check('Cost_Center_all')) {
      emitter.emit('showToast', {
        severity: 'warn',
        life: 5000,
        summary: $t('窗口模板不可用'),
        detail: (
          <I18nT keypath={$t('窗口模板不可用，请联系空间的拥有者进行升级，或{link}以激活该跨空间功能。', { link: '{link}' })}>
            {{ link: () => <a class="cursor-pointer" onClick={switchWorkspaceAndToUpgradePlan}>{$t('前往升级您的权益')}</a> }}
          </I18nT>
        ),
      })
    }
    else {
      emitter.emit('showPayWall', {
        event,
        params: {
          type: 'createProfileTemplates',
        },
      })
    }
    return
  }

  showSimpleDialog({
    title: option?.value ? $t('编辑模板') : $t('保存模板'),
    content: $t('请在以下文本框输入模板名称:'),
    inputs: [
      {
        type: 'text',
        name: 'templateName',
        value: option?.label,
        required: true,
        props: {
          placeholder: $t('模板名称'),
        },
      },
    ],
    afterRender: () => (
      <ol class="pl-3.5 m-0 color-[var(--colors-text-text-secondary)]">
        <li>{$t('模板将保存系统、内核、UA以及设置中的信息。')}</li>
        <li>{$t('代理 IP，平台账号以及 cookies 信息将不会被保存。项目、标签和备注等非窗口信息也将不会被保存。')}</li>
      </ol>
    ),
    onConfirm: async (data: any) => {
      onSaveTemplate({ templateName: data.templateName, id: Number(option?.value) })
    },
  })
}

async function onSaveTemplate({ templateName, id }: { templateName: string, id?: number }) {
  const content = JSON.stringify(getFormDataByList(inputsGroup.value))

  const { code, msg } = id
    ? await API.window.userMdfWindowTemplateInfoCreate({ id, templateName, content })
    : await API.window.userAddWindowTemplateInfoCreate({ templateName, content })

  if (code !== 0) {
    handleBusinessCode(code, () => {
      onlyErrorToast(code, msg)
    })
    return
  }

  if (id && Number(profileTemplate.value) === id) {
    profileTemplate.label = templateName
  }
  getTemplateList()
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
      onlyErrorToast(code, msg)
      if (code === 0) {
        getTemplateList()
      }
    },
  })
}

function importSuccess(data: any) {
  fileAnalyzeData.value = data
}

async function createProfile(openBrowser: boolean) {
  clearDriver()
  const _metaData = filterFieldByValue(toRaw(metaData.value) as object, v => !isEmptyValue(v))
  const formData = getFormDataByList(inputsGroup.value, _metaData)
  const params = {
    createCount: createCount.value,
    ...original.value,
    ...formData,
  }
  switch (tabsValue.value) {
    case 'single':
      return singleCreateProfile(params, openBrowser)
    case 'multiple':
      return batchCreateProfile(params)
    case 'import':
      return importProfile(params)
  }
}

async function singleCreateProfile(params: any, openBrowser: boolean) {
  loading.value = true
  const { code, data, msg } = await API.window.userAddWindowInfoV2Create(params)
  onlyErrorToast(code, msg)
  if (code === 0) {
    onBack(data, openBrowser)
    workspaceStore.getWorkspaceList()
    userStore.fetchUserInfo()
  }
  loading.value = false
}

async function batchCreateProfile(params: any) {
  const { createCount, proxyInfoList, platformBindType, windowPlatformList, platformUrlIds, _custom_ua } = params
  // 差异数量，代理总数量在 input 内的 formatValue 函数中有处理
  const proxyDiffCount = createCount - proxyInfoList.length
  if (proxyDiffCount < 0) {
    onlyErrorToast(-1, $t('代理 IP 数量不能大于窗口'))
    return
  }
  const accountDiffCount = createCount - windowPlatformList.length - platformUrlIds.length
  if (platformBindType === AccountBindType.Order && accountDiffCount < 0) {
    onlyErrorToast(-1, $t('账号数量不能大于窗口'))
    return
  }

  loading.value = true
  const fingerDetail = await ceateRandomFinger(previewInputs.value, { count: params.createCount, preview: false })
  params.proxyInfoList = params.proxyInfoList.concat(Array.from({ length: proxyDiffCount }).fill({ id: 0, proxyCategory: 'noproxy' }))// 代理数量小于创建数量补充为直连
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
    router.back()
    workspaceStore.getWorkspaceList()
    userStore.fetchUserInfo()
  }
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
  const fingerCount = fileAnalyzeData.value.excelData.length
  const fingerDetail = (await ceateRandomFinger(previewInputs.value, { count: fingerCount })).map(({ webGLManufacturer, webGLRender, ...item }: any) => {
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

function onBack(data?: any, openBrowser = false) {
  const { path, query } = backRoute
  const backRoutes = ['/browser', '/projects']
  const toPath = !backRoutes.some(n => path?.startsWith(n)) || path === '/browser/edit' ? '/browser' : path
  router.replace({
    path: toPath,
    query: {
      ...query,
      title: metaData.value.projectName,
      browser: JSON.stringify({ windowId: data?.windowId, openBrowser }),
    },
  })
}
</script>

<template>
  <div class="relative flex flex-col h-full">
    <ViewsHeader show-back :divider="false" :title="$t('创建窗口')" />
    <RxTabs v-model:value="tabsValue" :tabs="tabs" only-tabs />
    <div class="flex flex-1 px-28 overflow-hidden overflow-x-auto">
      <div class="w-full h-full flex flex-col ma-auto" :class="[collapsed ? 'min-w-[768px] max-w-[768px]' : 'min-w-[960px] max-w-[1140px]']">
        <div class="flex-1 flex gap-8 overflow-hidden">
          <div class="flex-1 flex flex-col">
            <div v-if="tabsValue === 'multiple'" class="mx-4 py-4 multiple">
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
            <AccordionInputs class="flex-1" :accordions="accordions" :inputs-group="inputsGroup">
              <template #before>
                <ImportWindow v-if="tabsValue === 'import'" v-model:error="fileAnalyzeError" class="pt-4" @import-success="importSuccess" />
                <div v-if="tabsValue !== 'import'" class="flex items-center justify-between px-4 py-4">
                  <div class="subtitle">
                    {{ $t('窗口信息') }}
                  </div>
                  <RxButton text severity="secondary" icon="base/rx_ic_template" :label="profileTemplate.label" @click.stop="showTemplates($event)" />
                </div>
              </template>
            </AccordionInputs>
          </div>
          <PreviewCard v-model:collapsed="collapsed" :inputs-group="previewInputs" :is-batch="isBatch" :create-count="createCount" :show-overview="tabsValue !== 'import'" :on-shuffle="onShuffle" />
        </div>
        <div class="relative flex items-center gap-2 py-4 min-h-16 footer">
          <MateGroup v-model="metaData" class="flex-1" :show-remark="tabsValue !== 'import'" />
          <SplitButton v-if="tabsValue !== 'import'" severity="secondary" :label="$t('存为新模板')" :model="items" @click.stop="saveTemplatePopup($event)" />
          <RxButton class="guide2" :label="$t('创建窗口')" @click.stop="createProfile(false)" />
        </div>
      </div>
    </div>
    <div class="foot-separator" />
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

.multiple {
  border-bottom: 1px dashed var(--colors-border-divider-dashed);

  &-tip {
    margin-top: 4px;
    color: var(--colors-text-text-inactive);
    text-align: right;
    font-size: 12px;
  }
}

.footer {
  :deep(.p-button) {
    max-width: 150px;
  }

  :deep(.p-button-label) {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}

.foot-separator {
  position: absolute;
  bottom: 65.6px;
  left: 50%;
  transform: translateX(-50%);
  width: 100%;
  height: 1px;
  background-color: var(--colors-border-divider);
}

/* 引导高亮：与目标同尺寸，呼吸灯（明暗循环，无缩放扩散） */
:deep(.guide1-pulse-target.guide1-pulse-active) {
  position: relative;
  z-index: 10001;

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    box-sizing: border-box;
    border-radius: inherit;
    pointer-events: none;
    border: 2px solid rgba(255, 200, 0, 0.85);
    box-shadow: 0 0 0 0 rgba(255, 200, 0, 0);
    animation: guide1-breathe 2.3s ease-in-out infinite;
  }
}

@keyframes guide1-breathe {
  0%,
  100% {
    opacity: 0.3;
    border-color: rgba(255, 200, 0, 0.45);
    box-shadow: 0 0 0 0 rgba(255, 200, 0, 0);
  }

  50% {
    opacity: 1;
    border-color: rgba(255, 200, 0, 0.95);
    box-shadow: 0 0 2px 2px rgba(255, 200, 0, 0.42);
  }
}
</style>
