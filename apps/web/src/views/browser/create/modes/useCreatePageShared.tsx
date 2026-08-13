import type { CreateMode } from './types'
import type { WindowMetaData } from '../components/type'
import RxButton from '/@/components/rx-button'
import { RxSvgIcon } from '/@/components/rx-icon'
import { useConfirm } from 'primevue/useconfirm'
import { I18nT } from 'vue-i18n'
import { API } from '/@/api'
import { useSimpleDialog } from '/@/components/simplePopup'
import { usePopupMenu } from '/@/hooks/usePopupMenu'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { usePermission } from '/@/hooks/usePermission'
import { useBackRoute } from '/@/router/navigation'
import { useUserStore } from '/@/stores/user'
import { useWorkspaceStore } from '/@/stores/workspace'
import { LIST_CACHE_NAMESPACE, useListCacheActions } from '/@/stores/listCache'
import { createTableContext } from '../hooks/useContext'
import { useWindowCreateCore } from '../hooks/useWindowCreateCore'
import { getDefaultTemplate } from '../utils'
import { switchWorkspaceAndToUpgradePlan, useHandleBusinessCode } from '/@/hooks/useResponseToast/handleBusinessCode'
import { deepClone, filterInputsByNames, genDriver, getFormDataByList, getLocalStorageDriverStatus, setInputValue, setLocalStorageDriverStatus, sleep } from '/@/utils'
import { emitter } from '/@/utils/eventBus'
import { withModifiers } from 'vue'

/**
 * 创建窗口页私有编排：form core、模板、tab 缓存、回跳与引导。
 * 不作为电商等外部页面的公共 API。
 */
export function useCreatePageShared() {
  const route = useRoute()
  const confirm = useConfirm()
  const router = useRouter()
  const workspaceStore = useWorkspaceStore()
  const userStore = useUserStore()
  const backRoute = useBackRoute()
  const { userPayInfo } = storeToRefs(userStore)
  const { handleBusinessCode } = useHandleBusinessCode()
  const { showSimpleDialog } = useSimpleDialog()
  const { showMenu } = usePopupMenu()
  const [, onlyErrorToast] = useResponseToast()
  const { invalidateCache: invalidateListCache } = useListCacheActions()
  const { check } = usePermission()

  const isBatch = ref(false)
  const createCount = ref(1)
  const driverObj = ref()
  const presetTemplate = ref()
  const oneClickSettings = ref()
  /** 购买流程临时挂起引导，避免 destroy 时误记 oneClick 完成 */
  let guideSuspended = false

  const tableContext = {
    isBatch,
    createCount,
    driverObj,
    presetTemplate,
    oneClickSettings,
    pauseCreateGuide: () => false,
    continueCreateGuideAfterBuy: async () => { },
  }
  createTableContext(tableContext)

  const tabs: { title: string, value: CreateMode }[] = [
    { title: $t('单个创建'), value: 'single' },
    { title: $t('批量创建'), value: 'multiple' },
    { title: $t('窗口导入'), value: 'import' },
  ]
  const tabsValue = ref<CreateMode>(tabs[0]!.value)
  const rawMainSetting = ref<any[]>([])
  const metaData = ref<WindowMetaData>({
    projectName: $t('未指定项目'),
    projectId: undefined,
    labelIds: [],
    windowRemark: '',
  })
  const collapsed = ref(false)

  const {
    mainSetting,
    extraSettings,
    loading,
    formGate,
    canSubmit,
    initialize,
    syncMobileVisibility,
    updateFingerprint,
    shuffleFingerprint,
    buildCreateParams,
    prepareCreateParams,
    executeSingleCreate,
  } = useWindowCreateCore({
    getFingerprintInputs: state => tabsValue.value === 'import'
      ? [rawMainSetting.value, ...state.extraSettings.value]
      : state.inputsGroup.value,
    resolveMobileVisible: () => tabsValue.value === 'import' ? true : undefined,
    onInputsInitialized: (state) => {
      // 导入模式需要保留系统、系统版本和内核版本的默认值作为预览基准
      rawMainSetting.value = state.mainSetting.value.map(input => deepClone(input))
    },
    onInitialized: getSettings,
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
      initialize(template)
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
    syncMobileVisibility()
    updateFingerprint()
  })

  onBeforeMount(() => {
    getTemplateList()
    initialize()
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

  async function getSettings() {
    if (route.query.driver || !getLocalStorageDriverStatus('oneClick')) {
      nextTick(() => {
        showGuide(0)
      })
    }
  }

  function showGuide(stepIndex = 0) {
    if (!document.querySelector(stepIndex === 0 ? '.guide1' : '.guide2'))
      return

    driverObj.value = genDriver({
      showProgress: false,
      disableActiveInteraction: false,
      allowClose: true,
      showButtons: ['close'],
      stagePadding: 4,
      overlayClickBehavior: (_, __, opts) => {
        opts.driver.destroy()
        driverObj.value = undefined
      },
      steps: [
        {
          element: '.guide1',
          popover: {
            description: $t('在这里购买高纯净度代理 IP'),
            side: 'right',
            align: 'center',
          },
          onHighlightStarted: () => {
            nextTick(() => {
              requestAnimationFrame(() => {
                document.querySelector('.guide1')?.classList.add('guide1-pulse-active')
              })
            })
          },
          onDeselected: () => {
            clearGuide1Highlight()
            // 购买流程挂起时不记完成；关闭弹窗后会进 guide2 再记
            if (!guideSuspended)
              setLocalStorageDriverStatus('oneClick', true)
          },
        },
        {
          element: '.guide2',
          popover: { description: $t('点击完成创建。'), side: 'top', align: 'end' },
          onDeselected: () => {
            setLocalStorageDriverStatus('oneClick', true)
          },
        },
      ],
    })
    driverObj.value.drive(stepIndex)
  }

  /** 点击购买：收起引导，避免遮罩挡弹窗 */
  function pauseCreateGuide() {
    if (!driverObj.value)
      return false
    guideSuspended = true
    clearGuide1Highlight()
    driverObj.value.destroy()
    driverObj.value = undefined
    return true
  }

  /** 购买弹窗关闭后：聚焦创建按钮 */
  async function continueCreateGuideAfterBuy() {
    await sleep(300)
    await nextTick()
    guideSuspended = false
    setLocalStorageDriverStatus('oneClick', true)
    showGuide(1)
  }

  tableContext.pauseCreateGuide = pauseCreateGuide
  tableContext.continueCreateGuideAfterBuy = continueCreateGuideAfterBuy

  function clearDriver() {
    guideSuspended = false
    clearGuide1Highlight()
    if (driverObj.value) {
      driverObj.value.destroy()
      driverObj.value = undefined
    }
  }

  function clearGuide1Highlight() {
    document.querySelectorAll('.guide1.guide1-pulse-active').forEach(el => el.classList.remove('guide1-pulse-active'))
  }

  function choosePreset(data: any) {
    presetTemplate.value = data
    initialize(data.preset)
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
            <I18nT keypath={$t('窗口模板不可用，请联系团队的拥有者进行升级，或{link}以激活该跨团队功能。', { link: '{link}' })}>
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

  function invalidateBrowserListCache() {
    invalidateListCache(LIST_CACHE_NAMESPACE.BROWSER_LIST, { projectId: '' })
    if (metaData.value.projectId)
      invalidateListCache(LIST_CACHE_NAMESPACE.BROWSER_LIST, { projectId: String(metaData.value.projectId) })
  }

  function onBack(data?: any, openBrowser = false) {
    invalidateBrowserListCache()
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

  return {
    tabs,
    tabsValue,
    isBatch,
    createCount,
    driverObj,
    presetTemplate,
    oneClickSettings,
    rawMainSetting,
    metaData,
    collapsed,
    mainSetting,
    extraSettings,
    loading,
    formGate,
    canSubmit,
    initialize,
    syncMobileVisibility,
    updateFingerprint,
    shuffleFingerprint,
    buildCreateParams,
    prepareCreateParams,
    executeSingleCreate,
    profileTemplate,
    items,
    maxWindowCount,
    inputsGroup,
    previewInputs,
    clearDriver,
    choosePreset,
    showTemplates,
    saveTemplatePopup,
    onBack,
    workspaceStore,
    userStore,
  }
}

export type CreatePageShared = ReturnType<typeof useCreatePageShared>
