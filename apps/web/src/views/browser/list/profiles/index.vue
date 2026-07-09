<script setup lang="tsx">
import { h } from 'vue'
import BrowserControl from './components/browser-control.vue'
import ClearCache from './components/clear-cache.vue'
import CustomFilters from './components/custom-filters.vue'
import ExportProfiles from './components/export-profiles.vue'
import ProfileInfo from './components/profile-info/index.vue'
import ProjectIcon from './components/project-icon.vue'
import TagsIcon from './components/tags-icon.vue'
import ProfileName from './components/profile-name.vue'
import AdvancedSearch from '/@/views/browser/list/profiles/components/advanced-search.vue'
import GuideModal from '/@/views/tutorial/components/guide-modal.vue'
import TutorialVideo from '/@/views/tutorial/components/tutorial-video.vue'
import ProxyCreate from '/@/views/agent/create/quick.vue'
import ProxyQuick from '/@/views/agent/quick.vue'
import AccountCreate from '/@/views/account/create/quick.vue'
import AccountList from '/@/views/account/list/quick.vue'
import TransferModal from '/@/views/browser/list/transfer/components/transfer-modal.vue'
import { RxAlert } from '/@/components/rx-alert'
import { useConfirm } from 'primevue/useconfirm'
import { useDialog } from 'primevue/usedialog'
import { format } from 'date-fns'
import { I18nT } from 'vue-i18n'
import { API } from '/@/api'
import { useContextMenu } from '/@/components/rx-ctxmenu'
import { useSimpleDialog } from '/@/components/simplePopup'
import { ClearType, CoreType, ProfileModifyType, ProfileReqType, ProxyType } from '/@/enums'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { useUserStore } from '/@/stores/user'
import { usePermission } from '/@/hooks/usePermission'
import { blurDomSpotlight, focusDomSpotlight } from '/@/hooks/useDomSpotlight'
import { copyText, deepClone, genDriver, genPollingChecker, safeParseJSON } from '/@/utils'
import { useMateGroup } from '/@/views/browser/create/hooks/useMate'
import { useTagsActions } from '/@/views/browser/list/tags/hook'
import { getColumns } from './columns'
import { silentUpdateAccount, silentUpdateProxy } from './components/util'
import { getAdvancedSearch, getCustomFilters, getOperation, getSorts } from './operation'
import { switchWorkspaceAndToUpgradePlan, useHandleBusinessCode } from '/@/hooks/useResponseToast/handleBusinessCode'
import { useDialog as RxUseDialog } from '/@/hooks/useDialog'
import { emitter, useEmitterEvent } from '/@/utils/eventBus'
import { useDrawer } from '/@/hooks/useDrawer'
import { useOnboardingTaskStatus } from '/@/views/tutorial/hooks.ts'
import { useProfileProxy } from '/@/views/browser/list/profiles/hooks/useProfileProxy'
import { useProfileProxySpeedTest } from '/@/views/browser/list/profiles/hooks/useProfileProxySpeedTest'
import { useCookie } from '/@/views/browser/list/profiles/hooks/useCookie'
import { useTrack } from '/@/views/browser/list/profiles/hooks/useOperationTrack'
import { useProfileOpenState } from '/@/views/browser/list/profiles/hooks/useProfileOpenState'
import { useProfilesTable } from '/@/views/browser/list/profiles/hooks/useProfilesTable'
import { useWindowModify } from '/@/views/browser/list/profiles/hooks/useWindowModify'
import { createProfileOperationHandler } from '/@/views/browser/list/profiles/operationHandlers'
import { buildCustomFilterParamsFromMenu } from '/@/views/browser/list/profiles/utils/filterParams'
import { useSimpleLocale } from '/@/stores/locale'
import { LIST_CACHE_NAMESPACE, useListCacheActions, useListCacheStore } from '/@/stores/listCache'
import { useWorkspaceStore } from '/@/stores/workspace'

import useColumns from '/@/hooks/useColumns'

import type { UserGetWindowInfoListListData } from '@roxy/backend-api'

type Data = UserGetWindowInfoListListData['data']['rows'][number]

const props = withDefaults(defineProps<{
  currentFilter?: Record<string, any>
  isProjectProfile?: boolean
}>(), {
  isProjectProfile: false,
})

const emit = defineEmits(['updateFilterTabs', 'switchTab'])

const route = useRoute()
const router = useRouter()
const confirm = useConfirm()
const dialog = useDialog()
const drawerInstance = useDrawer()
const { userInfo, userConfig } = storeToRefs(useUserStore())
const { handleBusinessCode } = useHandleBusinessCode()
const { updateOnboardingTaskStatus } = useOnboardingTaskStatus()
const { getProjects } = useMateGroup()
const [showModal] = RxUseDialog()
const [showToast, onlyErrorToast] = useResponseToast()
const [addTag] = useTagsActions()
const [show] = useContextMenu()
const { showSimpleDialog } = useSimpleDialog()
const { buildProxyData, confirmDeleteProxy } = useProfileProxy()
const { runProxySpeedTestForRows } = useProfileProxySpeedTest()
const { editCookieByProfile, startCookieRobot } = useCookie()
const { saveLocalTrack } = useTrack()
const { check } = usePermission()
const { getVideoSource } = useSimpleLocale()
const workspaceStore = useWorkspaceStore()
const listCacheStore = useListCacheStore()
const { invalidateCache: invalidateProfilesListCache } = useListCacheActions()
const { columns, updateColumns, updateRemarkDisplayStatus } = useColumns(getColumns(), props.isProjectProfile ? ['project'] : undefined)

const tableRef = useTemplateRef('windowTable')
const tagsIconRef = useTemplateRef('tagsIcon')
const filtersMenu = ref()
const listInitialized = ref(false)
const advancedSearchOptions = getAdvancedSearch()
const driverObj = ref()
const checkerLoading = ref(false)

const {
  openMessage,
  workspaceName,
  listenOpenMessage,
  listenCloseMessage,
  listenCloseSyncingDataMessage,
  openBrowserBefore,
  getNotUsedProfiles,
  syncOpenedBrowserState,
  sendFirstOpenRecord,
} = useProfileOpenState()

const { dataList, hasFiltered, hasTempProfile, clearPendingAutoOpen, syncOpenedProxyToRow, onRefreshTable, tableRequest, syncFromCacheEntry } = useProfilesTable({
  tableRef,
  filtersMenu,
  getCurrentFilterParams: () => props.currentFilter?._params,
  openBrowserBefore,
})

function getProfilesListCacheScope() {
  return props.isProjectProfile
    ? { projectId: String(route.params.id ?? '') }
    : { projectId: '' }
}

function invalidateProfilesListCacheForProjectId(projectId: string | number) {
  invalidateProfilesListCache(LIST_CACHE_NAMESPACE.BROWSER_LIST, { projectId: String(projectId) })
}

function invalidateProfilesListCacheScope() {
  invalidateProfilesListCacheForProjectId(getProfilesListCacheScope().projectId as string)
}

function invalidateAndRefreshProfilesList(tabParams: Record<string, unknown> = {}, force = false) {
  invalidateProfilesListCacheScope()
  onRefreshTable(tabParams, force)
}

function getProfilesCacheEntry() {
  const workspaceId = workspaceStore.currentWorkspace?.id
  if (!workspaceId)
    return null
  return listCacheStore.get(
    LIST_CACHE_NAMESPACE.BROWSER_LIST,
    String(workspaceId),
    getProfilesListCacheScope(),
  )
}

/** 缓存仅对应离开时的单个 Tab；只有当前 Tab 与缓存 meta.activeTabId 一致时才允许恢复 */
function shouldRestoreProfilesListCache() {
  const entry = getProfilesCacheEntry()
  if (!entry)
    return false
  if (props.isProjectProfile)
    return true
  const cachedTabId = entry.meta?.activeTabId as string | undefined
  const currentTabId = props.currentFilter?.id ?? 'rx_1000'
  return !!cachedTabId && cachedTabId === currentTabId
}

/** 父组件尚未把 activeTab 切到缓存记录的 Tab 时，暂缓初始化 */
function isWaitingForCachedTabRestore() {
  if (props.isProjectProfile)
    return false
  const cachedTabId = getProfilesCacheEntry()?.meta?.activeTabId as string | undefined
  if (!cachedTabId)
    return false
  const currentTabId = props.currentFilter?.id ?? 'rx_1000'
  return cachedTabId !== currentTabId
}

function listCacheMeta() {
  const meta: Record<string, unknown> = {}
  if (!props.isProjectProfile)
    meta.activeTabId = props.currentFilter?.id ?? 'rx_1000'
  if (filtersMenu.value)
    meta.filtersMenu = filtersMenu.value
  return meta
}

function tryRestoreProfilesFromCache() {
  if (!shouldRestoreProfilesListCache())
    return false
  const entry = getProfilesCacheEntry()
  if (!entry)
    return false
  syncFromCacheEntry(entry)
  return true
}

async function loadFiltersForCurrentTab() {
  const filter = props.currentFilter
  if (!filter)
    return
  filtersMenu.value = await getCustomFilters(filter.filter_condition || {})
}

async function initializeProfilesList() {
  if (listInitialized.value || isWaitingForCachedTabRestore())
    return

  listInitialized.value = true
  await loadFiltersForCurrentTab()

  if (shouldRestoreProfilesListCache()) {
    tableRef.value?.restoreFromCache()
    tryRestoreProfilesFromCache()
    return
  }

  const customFilterParams = safeParseJSON(route.query.customFilterParams, {})
  onRefreshTable({
    ...customFilterParams,
    ...(props.currentFilter?._params ?? {}),
  }, false)
}

async function refreshOnTabSwitch() {
  if (!props.currentFilter)
    return

  if (!listInitialized.value) {
    await initializeProfilesList()
    return
  }

  await loadFiltersForCurrentTab()
  onRefreshTable(props.currentFilter._params ?? {}, false)
}

const { singleModifyWindow, batchModifyWindow, updateProfileMeta } = useWindowModify({
  onlyErrorToast,
  onRefreshTable,
  invalidateListCache: invalidateProfilesListCacheScope,
})

watch(() => props.currentFilter?.id, () => {
  void refreshOnTabSwitch()
})

watch(
  () => route.params.id,
  async () => {
    if (!route.params.id)
      return
    listInitialized.value = false
    await nextTick()
    await initializeProfilesList()
  },
)

let cancelOpenListener: (() => void) | undefined
let cancelCloseListener: (() => void) | undefined
let cancelCloseSyncingDataListener: (() => void) | undefined

const scheduledCheckerProxyStatus = genPollingChecker({
  intervalMs: 5 * 60 * 1000,
  checkOnce: async () => {
    if (!userConfig.value.autoDetectProxy)
      return true
    await testAllProxy(true)
    return false
  },
})

useEmitterEvent('refreshProfileList', async (windowId?: number) => {
  if (windowId) {
    router.replace({ name: route.name, query: { browser: JSON.stringify({ openBrowser: true, windowId }) } })
  }
  invalidateAndRefreshProfilesList()
})

onBeforeMount(() => {
  scheduledCheckerProxyStatus.check()
  cancelOpenListener = listenOpenMessage({
    onOpenSuccess: (dirId) => {
      void syncOpenedProxyToRow(dirId)
      driverNext()
    },
    onOpenFailed: clearPendingAutoOpen,
  })
  cancelCloseListener = listenCloseMessage()
  cancelCloseSyncingDataListener = listenCloseSyncingDataMessage()

  if (userInfo.value.onboardingTaskStatus?.firstRegisterGuideStatus === false)
    emitter.on('firstRegisterGuide', onFirstRegisterGuide)

  // 列表备注显示状态现在保存到后台
  updateColumns((columns) => {
    const column = columns.find(column => column.key === 'note')
    if (column) {
      Reflect.set(column._cache, 'extend', userConfig.value.remarkDisplayStatus!)
    }
  })

  void syncOpenedBrowserState()

  void nextTick(() => initializeProfilesList())
})

onBeforeUnmount(() => {
  scheduledCheckerProxyStatus.stop()
  emitter.off('firstRegisterGuide', onFirstRegisterGuide)
  cancelOpenListener?.()
  cancelCloseListener?.()
  cancelCloseSyncingDataListener?.()
})

async function onFirstRegisterGuide() {
  await tableRef.value?.refresh({}, true)
  nextTick(() => {
    driverObj.value = genDriver({
      showProgress: false,
      disableActiveInteraction: false,
      allowClose: true,
      overlayClickBehavior: 'close',
      showButtons: ['close'],
      stagePadding: 0,
      popoverOffset: 20,
      onDestroyed: () => {
        blurDomSpotlight()
      },
      steps: [
        {
          element: '#OPEN_0',
          popover: {
            description: $t('点击「打开」以启动浏览器。'),
            side: 'right',
            align: 'center',
          },
          onHighlightStarted: () => {
            nextTick(() => {
              requestAnimationFrame(() => {
                focusDomSpotlight('#OPEN_0')
              })
            })
          },
          onDeselected: () => {
            blurDomSpotlight()
          },
        },
      ],
    })

    driverObj.value.drive()
  })
}

function driverNext() {
  if (driverObj.value) {
    driverObj.value = undefined
    emitter.emit('asideMenuGuide')
  }
}

async function testAllProxy(silent = false) {
  if (!check('Profiles_speed_test_proxy'))
    return

  if (!dataList.value?.length) {
    !silent && onlyErrorToast(-1, $t('暂无窗口'))
    return
  }

  const targets = dataList.value.filter(row => row.proxyCategory !== 'noproxy')
  if (!targets.length) {
    !silent && onlyErrorToast(-1, $t('当前没有已绑定代理 IP 的窗口'))
    return
  }

  if (checkerLoading.value)
    return
  checkerLoading.value = true
  await runProxySpeedTestForRows(targets, { showConcurrentTaskTopBar: !silent, silent })
  checkerLoading.value = false
}

async function onTestProxy(data: any) {
  const datas: Data[] = [].concat(data)

  const targets = datas.filter(row => row.proxyCategory !== 'noproxy')
  if (!targets.length) {
    onlyErrorToast(-1, $t('当前没有已绑定代理 IP 的窗口'))
    return
  }
  await runProxySpeedTestForRows(targets)
}

async function saveFilters(formData: any) {
  if (!filtersMenu.value.some((item: any) => item.value)) {
    return
  }
  const { filter_name, filter_rule, sort } = formData

  const filter_condition = buildCustomFilterParamsFromMenu(filtersMenu.value)

  const isEdit = !!sort

  const { code, msg } = isEdit
    ? await API.window.userUpdateWindowFilterNameCreate({
        sort,
        filter_rule,
        filter_condition,
        old_filter_name: filter_name,
        new_filter_name: filter_name,
      })
    : await API.window.userAddWindowFilterNameCreate({
        filter_name,
        filter_condition,
        filter_rule: columns.value.map((column: any) => ({ name: column.key, sort: column._sort, status: column._visible ? 1 : 0 })),
      })
  if (code === 0) {
    emit('updateFilterTabs', isEdit)
  }
  onlyErrorToast(code, msg)
}

function onAdvancedSearch(search?: Record<string, any>) {
  const { key, value } = search || {}
  onRefreshTable({ queryKey: value && (key || 'name_remark'), queryValue: value }, true)
}

const operationHandler = createProfileOperationHandler({
  saveLocalTrack,
  tableRef,
  filtersMenu,
  router,
  route,
  getCurrentFilter: () => props.currentFilter,
  copyTextFn: copyText,
  showToast,
  onTransfer,
  onMoveToProject,
  openBrowserBefore,
  setAsDefaultBrowser,
  createDesktopShortcut,
  multipleProxyChange,
  multipleProxyDelete,
  multipleAccountChange,
  tagsIconRef,
  addTag,
  updateProfileMeta,
  singleModifyWindow,
  onRemark,
  onEditCookies,
  openCookieRobot,
  onClearCache,
  exportProfile,
  deleteProfile,
  onTestProxy,
})

async function setAsDefaultBrowser(data: Data) {
  const sortNum = `${data.windowSortNum}`.padStart(`${data.maxWindowSort || 0}`.length, '0')
  await globalThis.electronAPI.send('browser:setAsDefaultBrowser', {
    ...toRaw(data),
    __orderName: `${workspaceName.value}-${sortNum}`,
  } as any)
  showToast(0, $t('设为默认浏览器成功'))
}

async function createDesktopShortcut(data: Data) {
  const sortNum = `${data.windowSortNum}`.padStart(`${data.maxWindowSort || 0}`.length, '0')
  await globalThis.electronAPI.send('browser:createDesktopShortcut', {
    ...toRaw(data),
    __orderName: `${workspaceName.value}-${sortNum}`,
  } as any)
  showToast(0, $t('创建桌面快捷方式成功'))
}

function showOperationMenu(props: { event: Event, operation: any[] }, data: any) {
  if (userInfo.value.onboardingTaskStatus?.contextMenuGuideStatus) {
    show(props.event, {
      operation: props.operation,
      operationHandler: async (operate: any) => {
        try {
          const _operate = { ...deepClone(toRaw(operate)), _event: props.event }
          await operationHandler(_operate, data)
        }
        catch (error) {
          console.error(error)
        }
      },
    })
    return
  }

  showModal({
    showHeader: false,
    modal: true,
    blockScroll: true,
    handleCancel: () => updateOnboardingTaskStatus({ contextMenuGuideStatus: true }),
    slots: {
      container: ({ handleCancel }) => (
        <GuideModal
          title={$t('鼠标右键编辑')}
          desc={({ class: className }) => {
            return <div class={className}>{$t('绝大多数的 Roxy浏览器列表允许您便捷地通过鼠标右键直接编辑，而无需寻找"更多操作"按钮。')}</div>
          }}
          video={getVideoSource('right-click.mp4')}
          onClose={handleCancel}
          onConfirm={handleCancel}
        >
        </GuideModal>
      ),
    },
  })
}

async function onTransfer(datas: Data[], operate?: any) {
  const { code } = await API.pay.userCheckTeamUserRightsList()
  if (code !== 0) {
    if (!check('Cost_Center_all')) {
      emitter.emit('showToast', {
        severity: 'warn',
        life: 5000,
        summary: $t('窗口转移不可用'),
        detail: (
          <I18nT keypath={$t('窗口转移不可用，请联系团队的拥有者进行升级，或{link}以激活该跨团队功能。', { link: '{link}' })}>
            {{ link: () => <a class="cursor-pointer" onClick={switchWorkspaceAndToUpgradePlan}>{$t('前往升级您的权益')}</a> }}
          </I18nT>
        ),
      })
      return
    }

    if (operate._event && ['quick', 'batch_quick'].includes(operate._type)) {
      emitter.emit('showPayWall', {
        event: operate._event,
        params: {
          type: 'transfer',
        },
      })
    }
    else {
      emitter.emit('showToast', {
        severity: 'warn',
        life: 5000,
        summary: $t('窗口转移不可用'),
        detail: (
          <I18nT keypath={$t('窗口转移为 Roxy 会员功能，{link}以解锁', { link: '{link}' })}>
            {{ link: () => <a class="cursor-pointer" onClick={switchWorkspaceAndToUpgradePlan}>{$t('单击此处升级')}</a> }}
          </I18nT>
        ),
      })
    }
    return
  }

  const result = await getNotUsedProfiles(datas)
  if (result.length !== datas.length) {
    onlyErrorToast(-1, $t('当前已打开的窗口无法被转移'))
    return
  }

  const { promise, resolve, reject } = Promise.withResolvers<void>()
  showModal({
    showHeader: false,
    modal: true,
    blockScroll: true,
    pt: {
      content: '!pa-0',
    },
    slots: {
      container: ({ hideModal }) => h(TransferModal, {
        datas,
        ids: datas.map(item => item.id!),
        buyProxyType: datas.some(item => item.buyProxyType! === ProxyType.buy),
        onClose: () => {
          hideModal()
          reject()
        },
        onConfirm: async (params: Record<string, boolean>) => {
          hideModal()
          const { isSelf, needRefresh } = params || {}
          if (!isSelf) {
            showToast(0, $t('未接受或被拒绝的窗口将在24小时内自动返回。'))
            // 如果在项目列表中转移，转移成功则跳到转移中 tab
            if (route.name === 'project-item') {
              router.replace({ name: 'browser-list', query: { activeTabId: 'rx_1004' } })
            }
            else {
              emit('switchTab', 'rx_1004')
            }
          }
          else {
            if (needRefresh) {
              invalidateAndRefreshProfilesList()
            }
            showToast(0, $t('转移成功'))
          }
          resolve()
        },
      }),
    },
  })
  return promise
}

async function onMoveToProject(data: any) {
  const options = await getProjects()
  const datas: any[] = [].concat(data)

  const { promise, resolve, reject } = Promise.withResolvers<void>()

  const names = datas.slice(0, 10).map((item: any) => `${workspaceName.value}-${item.windowSortNum}`).join(', ')
  const namesStr = `[${names}${datas.length > 10 ? '...' : ''}]`

  showSimpleDialog({
    title: $t('移动项目'),
    content: $t('将移动 {names} 到所选项目', { names: namesStr }),
    inputs: [
      {
        type: 'select',
        name: 'projectId',
        props: {
          placeholder: $t('请选择项目'),
          options,
          optionValue: 'value',
        },
        resolver: (z: any) => z.string({
          invalid_type_error: $t('请选择项目'),
        }).min(1, $t('请选择项目')),
      },
    ],
    onConfirm: async (formData: any) => {
      if (formData.projectId) {
        const ids = datas.filter((item: any) => item.projectId !== Number(formData.projectId)).map((item: any) => item.id)
        if (!ids.length) {
          onlyErrorToast(-1, $t('所选窗口 {names} 已在该项目中', { names: namesStr }))
          return
        }

        await batchModifyWindow({ ids, projectId: formData.projectId, requestType: ProfileReqType.MoveProject }, !props.isProjectProfile)
          .then(() => {
            const projectName = options.find(item => item.value === formData.projectId)!.label
            datas.forEach((item) => {
              item.projectName = projectName
              item.projectId = Number(formData.projectId)
              item.labelInfo = item.labelInfo!.filter((it: any) => !it.labelId.startsWith?.('u_'))
              item.labelIds = item.labelInfo!.map((it: any) => it.labelId)
            })
            invalidateProfilesListCacheForProjectId(formData.projectId)
            if (props.isProjectProfile)
              invalidateProfilesListCacheScope()
          })
      }
      resolve()
    },
    onCancel: reject,
  })

  return promise
}

function multipleProxyChange(data: Data | Data[], { operationType, proxyMethod }: any) {
  const { promise, resolve } = Promise.withResolvers<void>()

  const datas = ([] as Data[]).concat(data)
  const isMulti = operationType === 'batch'
  const isChoose = proxyMethod === 'choose'

  const _proxydata = buildProxyData(datas[0]!)

  const containerRender = isChoose
    ? () => (
        <div class="h-full flex flex-col">
          {isMulti && (
            <div class="px-4 pt-4">
              <RxAlert class="min-w-full" type="warn" closable={false} title={$t('此操作将覆盖所有选中窗口的代理 IP 设置，请谨慎操作。')}></RxAlert>
            </div>
          )}
          <div class="flex-1 overflow-hidden">
            <ProxyQuick data={isMulti ? undefined : _proxydata} onConfirm={onConfirm}></ProxyQuick>
          </div>
        </div>
      )
    : () => <ProxyCreate onConfirm={onConfirm}></ProxyCreate>

  drawerInstance.showDrawer({
    title: isChoose ? $t('选择代理 IP') : $t('添加代理 IP'),
    dismissable: false,
    slots: {
      container: containerRender,
    },
    onHide: resolve,
  })

  async function onConfirm({ id, ...formData }: any) {
    const { code, msg } = await API.window.userMdfWindowDataBatchCreate({
      type: isChoose ? ProfileModifyType.ProxySelect : ProfileModifyType.ProxyAdd,
      requestType: isChoose ? ProfileReqType.SelectProxy : ProfileReqType.AddProxy,
      ids: datas.map(item => item.id!),
      paramList: {
        moduleId: id ?? 0,
        proxyMethod,
        ...formData,
      },
    })
    drawerInstance.hideDrawer()
    onlyErrorToast(code, msg)
    if (code !== 0)
      return

    const { protocol, proxyCategory, proxyType, isDirect, ...rest } = formData
    const params = {
      ...rest,
      moduleId: id ?? 0,
      isDirect,
      proxyMethod,
      protocol,
      proxyCategory: proxyCategory || protocol,
      buyProxyType: proxyType ?? ProxyType.resource,
    }
    datas.forEach((item) => {
      silentUpdateProxy(item, params, isDirect ? [] : ['isEncryptProxy', 'proxyEncryptInfo'])
    })
  }

  return promise
}

function multipleProxyDelete(data: Data | Data[]) {
  const datas = ([] as Data[]).concat(data)
  return confirmDeleteProxy(datas)
}

function multipleAccountChange(data: Data | Data[], { operationType, isChoose = false }: any) {
  const { promise, resolve } = Promise.withResolvers<void>()

  const datas = ([] as Data[]).concat(data)
  const isMulti = operationType === 'batch'

  const title = isChoose ? $t('选择平台账号') : $t('添加平台账号')

  const containerRender = isChoose
    ? () => (
        <div class="h-full flex flex-col">
          {isMulti && (
            <div class="px-4 pt-4">
              <RxAlert class="min-w-full" type="warn" closable={false} title={$t('此操作将清空所选窗口中的平台账号，并将新选择的平台账号绑定至窗口，请谨慎操作。')}></RxAlert>
            </div>
          )}
          <AccountList class="flex-1 overflow-hidden" data={isMulti ? undefined : datas[0]} onConfirm={onConfirm}></AccountList>
        </div>
      )
    : () => <AccountCreate showRemark={false} showCreateMore={false} onConfirm={onConfirm}></AccountCreate>

  drawerInstance.showDrawer({
    title,
    dismissable: false,
    slots: {
      container: containerRender,
    },
    onHide: resolve,
  })

  async function onConfirm(formData: any) {
    const { code, msg } = isMulti
      ? await multiConfirm(formData)
      : await singleConfirm(formData)
    drawerInstance.hideDrawer()
    onlyErrorToast(code, msg)
  }

  async function multiConfirm(dataList: any | any[]) {
    const platformUrlIds = ([] as any[]).concat(dataList).map(item => item.id)
    const paramList = isChoose ? { platformUrlIds } : { windowPlatformList: [dataList] }
    const type = isChoose ? ProfileModifyType.PlatformSelect : ProfileModifyType.PlatformAdd
    const requestType = isChoose ? ProfileReqType.SelectPlatform : ProfileReqType.AddPlatform
    const ids = datas.map(item => item.id!)

    const { code, msg } = await API.window.userMdfWindowDataBatchCreate({ paramList, type, requestType, ids } as any)

    if (code === 0) {
      datas.forEach((item, index) => {
        const _windowPlatformList = isChoose && Array.isArray(dataList)
          ? dataList
          : item.windowPlatformList!.concat({ ...dataList, _tempId: (Date.now() + index ** 2).toString(32) })
        silentUpdateAccount(item, _windowPlatformList)
      })
    }
    return { code, msg }
  }

  async function singleConfirm(formData: any) {
    const { id, dirId, windowPlatformList } = datas[0]!
    const params: any = { id, dirId }
    if (isChoose) {
      params.platformUrlIds = (formData as any[]).filter(item => item.id).map(item => item.id)
      params.requestType = ProfileReqType.SelectPlatform
    }
    else {
      params.windowPlatformList = windowPlatformList!.concat({ ...formData, _tempId: Date.now().toString(32) })
      params.requestType = ProfileReqType.AddPlatform
    }
    const { code, msg } = await API.window.userMdfWindowInfoSingleV2Create(params)
    if (code === 0) {
      const _windowPlatformList = params.windowPlatformList || windowPlatformList!.filter((item: any) => !item.id).concat(formData)
      silentUpdateAccount(datas[0]!, _windowPlatformList)
    }
    return { code, msg }
  }

  return promise
}

async function onEditCookies(data: Data | Data[]) {
  const datas = ([] as Data[]).concat(data)

  editCookieByProfile({
    data: datas,
    onConfirm: async (cookie: any) => {
      const { code, msg } = await API.window.userMdfWindowDataBatchCreate({
        type: ProfileModifyType.CookieEdit,
        requestType: ProfileReqType.EditCookie,
        ids: datas.map(item => item.id!),
        paramList: {
          cookie,
        },
      } as any)
      drawerInstance.hideDrawer()
      onlyErrorToast(code, msg)
      if (code !== 0)
        return
      datas.forEach((item) => {
        Reflect.set(item, 'cookie', cookie)
      })
    },
  })
}

async function openCookieRobot(data: Data | Data[]) {
  const datas = ([] as Data[]).concat(data)
  startCookieRobot(datas)
}

async function onRemark(data: Data | Data[]) {
  if (!check('Profiles_edit_remark')) {
    return
  }
  const { promise, resolve } = Promise.withResolvers<void>()

  const datas = ([] as Data[]).concat(data)

  showSimpleDialog({
    title: $t('为所选窗口添加备注'),
    inputs: [
      {
        type: 'textarea',
        name: 'windowRemark',
        value: datas[0]!.windowRemark,
        props: {
          placeholder: $t('请输入备注'),
          rows: 6,
        },
      },
    ],
    onConfirm: async (formData: any) => {
      const ids = datas.map(item => item.id)
      await batchModifyWindow({ ids, windowRemark: formData.windowRemark, requestType: ProfileReqType.EditRemark }, true)
      datas.forEach((item) => {
        item.windowRemark = formData.windowRemark
      })
    },
    onHide: resolve,
  })

  return promise
}

function toggleRemarkDisplayStatus(cache: Record<string, any>) {
  cache.extend = !cache.extend
  if (userConfig.value.remarkDisplayStatus !== cache.extend) {
    updateRemarkDisplayStatus(cache.extend)
  }
}

async function onClearCache(datas: any[]) {
  dialog.open(ClearCache, {
    props: {
      showHeader: false,
      modal: true,
      blockScroll: true,
    },
    data: {
      props: {
        title: $t('清空窗口缓存'),
        content: $t('常用于解决未知原因的环境打开异常或缓慢等问题。'),
      },
      onConfirm: async (result: ClearType) => {
        const dirIds = datas.map(item => item.dirId)
        if (result === ClearType.cloud) {
          await globalThis.electronAPI.send('browser:clearCache', { clearType: ClearType.all, dirIds }).finally(() => {
            return API.window.userClearWindowCacheCreate({ ids: datas.map(item => item.id) })
          })
        }
        else {
          await globalThis.electronAPI.send('browser:clearCache', { clearType: result, dirIds })
        }
      },
    },
  })
}

async function exportProfile(data: any) {
  dialog.open(ExportProfiles, {
    props: {
      showHeader: false,
      modal: true,
      blockScroll: true,
    },
    data: {
      props: {
        data,
        workspaceName: workspaceName.value,
      },
    },
  })
}

async function deleteProfile(datas: any, ids: number[]) {
  const result = await getNotUsedProfiles(datas)
  if (result.length !== datas.length) {
    onlyErrorToast(-1, $t('请先关闭窗口'))
    return
  }

  // 每次删除窗口前，先同步一下窗口的打开状态，避免无法删除
  const windowStatus = ids.map(id => ({ id, openStatus: false }))
  await API.window.userMdfWindowSyncV2Create(windowStatus)

  const usePeoples = datas.some((item: any) => item.statusInfo.some((status: any) => status.openUserId !== userInfo.value.id))

  if (usePeoples) {
    onlyErrorToast(-1, $t('无法删除正在被其他成员使用的窗口'))
    return
  }

  const { promise, resolve, reject } = Promise.withResolvers<void>()

  confirm.require({
    group: 'deleteConfirmDialog',
    header: $t('删除窗口'),
    message: $t('您确认要将所选窗口移至回收站吗？'),
    rejectProps: {
      label: $t('取消'),
      severity: 'secondary',
      outlined: true,
    },
    acceptProps: {
      label: $t('确认'),
      severity: 'danger',
    },
    checkboxProps: check('Profiles_permanent_delete') && { label: $t('彻底删除'), value: false },
    async accept() {
      if (this.checkboxProps.value) {
        const { code, msg } = await API.window.userDelWindowInfoCreate({ ids })
        onlyErrorToast(code, msg)
        if (code !== 0)
          return reject(msg)
        invalidateAndRefreshProfilesList()
        globalThis.electronAPI.send('browser:batchRemove', datas.map((item: any) => item.dirId))
      }
      else {
        await batchModifyWindow({ ids, isDelete: true, requestType: ProfileReqType.Delete })
      }

      resolve()
    },
    reject,
    onHide: reject,
  } as any)

  return promise
}

async function toCreateBrowser() {
  const { code, msg } = await API.window.userCheckWindowTotalCountList()
  if (code === 0) {
    router.push({ name: 'browser-create', query: { projectId: route.params.id } })
  }
  else {
    handleBusinessCode(code, () => {
      showToast(code, msg)
    })
  }
}

defineExpose({
  tableRef,
})
</script>

<template>
  <RyTable ref="windowTable" v-model:columns="columns" cache-key="browser-list" :list-cache-key="LIST_CACHE_NAMESPACE.BROWSER_LIST"
           :list-cache-scope="getProfilesListCacheScope" :list-cache-meta="listCacheMeta" :list-cache-should-restore="shouldRestoreProfilesListCache" :immediate="false" skeleton :table-sort="getSorts" :table-request="tableRequest" :table-operation="getOperation"
           :operation-handler="operationHandler" selection-mode="multiple" :show-actions="false" :virtual-scroller-options="{ itemSize: 60 }" class="window-table" removable-sort
  >
    <template #filter-after>
      <div class="w-full flex items-start gap-2">
        <AdvancedSearch :options="advancedSearchOptions" :search="onAdvancedSearch" :clear="onAdvancedSearch" />
        <RxDivider class="py-1" vertical line-only />
        <CustomFilters :current-filter="currentFilter" :filters-menu="filtersMenu" :enabled-filter-save="!isProjectProfile" :video-url="getVideoSource('profile-filter.mp4')"
                       :save-filters="saveFilters" @filter-change="onRefreshTable"
        />
        <RxButton v-if="check('Profiles_speed_test_proxy')" size="xxs" outlined severity="secondary" icon="base/rx_ic_speed_test" :label="$t('测试全部代理 IP')" @click.stop="testAllProxy()" />
      </div>
    </template>
    <template #table-empty>
      <CustomEmpty v-if="hasFiltered" icon="rx_illustration_filter.svg" :title="$t('暂无查询结果')" :desc="$t('当前条件下没有匹配的结果，请尝试更换其他筛选条件。')" />
      <CustomNewEmpty v-else icon="base/rx_ic_browser" img="empty-profiles.png" :title="$t('暂无窗口')" :desc="$t('窗口是 Roxy浏览器的核心功能，可以帮助您管理多个浏览器窗口，并为它们设置不同的项目、平台账号、代理 IP 等，以方便您更好地执行业务操作。')">
        <template #extra>
          <div class="flex gap-3">
            <RxButton v-if="check('Profiles_add')" severity="secondary" size="md" icon="base/rx_ic_browser_add" variant="outlined" :label="$t('创建窗口')" @click.stop="toCreateBrowser" />
            <TutorialVideo video-type="create_profile" :autoplay="false" />
          </div>
        </template>
      </CustomNewEmpty>
    </template>
    <template v-if="hasTempProfile" #column-before="{ ptProps }">
      <Column :pt="{ ...ptProps, bodycell: `${ptProps.bodycell} !pr-0` }" header-style="width:0%" body-style="width:0%">
        <template #body="{ data }">
          <RxTooltip v-if="data.isTemporary">
            <template #default>
              <SvgIcon class="pointer-events-none" name="base/rx_ic_sand_glass" color="var(--colors-icon-icon-warning)" />
            </template>
            <template #content>
              <div class="flex flex-col gap-1 w-50">
                <div class="temporary-title">
                  {{ $t('过期时间: {expires}', { expires: format(data.expireTime, 'yyyy/MM/dd') }) }}
                </div>
                <div class="temporary-desc">
                  {{ $t('临时窗口在过期前不占用您的窗口用量，可以正常使用。过期后将会占用您的窗口用量。用量不足将无法打开窗口。') }}
                </div>
              </div>
            </template>
          </RxTooltip>
        </template>
      </Column>
    </template>
    <template #profile="{ data }">
      <template v-if="data.id">
        <ProfileInfo :workspace-name="workspaceName!" :data="data" :open-message="openMessage" @refresh="invalidateAndRefreshProfilesList" />
      </template>
      <div v-else class="flex items-center gap-[16px]">
        <Skeleton width="44px" height="16px" />
        <div class="flex items-center gap-[1px]">
          <template v-for="i in 3" :key="i">
            <div v-if="i > 1" class="dotted-line" />
            <Skeleton width="24px" height="24px" border-radius="4px" />
          </template>
        </div>
      </div>
    </template>
    <template #profileName="{ data }">
      <template v-if="data.id">
        <ProfileName :data="data" :readonly="!check('Profiles_edit')" @refresh="invalidateAndRefreshProfilesList" />
      </template>
      <template v-else>
        <Skeleton width="160px" height="24px" border-radius="4px" />
      </template>
    </template>
    <template #open="{ data, index }">
      <template v-if="data.id">
        <BrowserControl :btn-id="`OPEN_${index}`" :data="data" :open-message="openMessage" :driver-obj="driverObj" :driver-next="driverNext" :send-first-open-record="sendFirstOpenRecord"
                        :icon="data.coreType === CoreType.Firefox ? 'base/rx_ic_firefox' : 'base/rx_ic_chrome'" @open="openBrowserBefore"
        />
      </template>
      <template v-else>
        <Skeleton width="70px" height="24px" border-radius="4px" />
      </template>
    </template>
    <template #noteHeader="{ column: { title, _cache } }">
      <div class="flex items-center gap-2 note-header">
        <span>{{ title }}</span>
        <SvgIcon v-tooltip.top="{ value: _cache.extend ? $t('收起') : $t('展开'), showDelay: 0 }" class="cursor-pointer color-[#989CA0]" :name="_cache.extend ? 'base/rx_ic_hidden' : 'base/rx_ic_eye'"
                 @click.stop="toggleRemarkDisplayStatus(_cache)"
        />
      </div>
    </template>
    <template #note="{ data, column: { _cache } }">
      <template v-if="data.id">
        <div class="inline-flex items-center gap-1" @click.stop="operationHandler({ name: 'addNotes' }, data)">
          <RxButton v-tooltip.top="{ value: data.windowRemark, showDelay: 0 }" class="shrink-0" :class="{ 'note-light': data.windowRemark }" text severity="secondary" size="xxs"
                    :icon="data.windowRemark ? 'base/rx_ic_doc_fill' : 'base/rx_ic_doc_add'"
          />
          <div v-if="_cache.extend" :title="data.windowRemark" class="min-w-50 whitespace-pre-wrap note-content">
            {{
              data.windowRemark }}
          </div>
        </div>
      </template>
      <template v-else>
        <Skeleton width="24px" height="24px" border-radius="4px" />
      </template>
    </template>
    <template #project="{ data }">
      <template v-if="data.id">
        <ProjectIcon :disabled="!check('Profiles_move_project')" :labels="data.labelInfo" :project-id="data.projectId" :project-name="data.projectName" @update="updateProfileMeta($event, data)" />
      </template>
      <template v-else>
        <Skeleton width="100px" height="20px" border-radius="4px" />
      </template>
    </template>
    <template #tags="{ data }">
      <template v-if="data.id">
        <TagsIcon :labels="data.labelInfo" :project-id="data.projectId" :gen-tag="check('Profiles_Label_add')" :disabled="!check('Profiles_select_label')"
                  @update="updateProfileMeta($event, data, 'single')"
        />
      </template>
      <template v-else>
        <Skeleton width="70px" height="24px" border-radius="12px" />
      </template>
    </template>
    <template #actions="{ data }">
      <div class="flex items-center gap-2">
        <template v-if="!data.id">
          <template v-for="i in 3" :key="i">
            <Skeleton width="24px" height="24px" border-radius="4px" />
          </template>
        </template>
        <template v-else>
          <div v-tooltip.top="{ value: $t('收藏'), showDelay: 500 }"
               class="flex justify-center items-center rounded cursor-pointer w-7 h-7 transition-all duration-150 hover:bg-black hover:bg-opacity-5 quick-icon"
               @click.stop="operationHandler({ name: 'fav' }, data)"
          >
            <SvgIcon :name="data.isOften ? 'base/rx_ic_bookmark_fill' : 'base/rx_ic_bookmark'" :class="{ 'color-[#FC9D12]': data.isOften }" />
          </div>
          <Actions :operation="getOperation(data)" :loading-operation-map="data.loadingOperationMap" @quick-click="operationHandler($event, data)" @more="showOperationMenu($event, data)" />
        </template>
      </div>
    </template>
  </RyTable>
  <TagsIcon ref="tagsIcon" :labels="[]" :show-create-tag="false" @update="updateProfileMeta($event, tableRef?.selectionData)" />
</template>

<style lang="scss" scoped>
.temporary {
  &-title {
    color: var(--component-tooltip-text-primary);
    font-size: 12px;
    font-weight: 600;
    line-height: 16px;
  }

  &-desc {
    color: var(--component-tooltip-text-secondary);
    font-size: 12px;
    line-height: 16px;
  }
}

.note-header {
  color: var(--colors-text-text-primary, #fafafa);
  font-size: 12px;
  line-height: 16px;
  font-weight: 600;
}

.note-content {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  overflow: hidden;
  text-overflow: ellipsis;
  word-break: break-all;
  line-height: 1.4;
}

.note-light {
  :deep(svg) {
    color: var(--colors-text-text-brand, #11a3fd) !important;
  }
}

.quick-icon {
  color: var(--colors-icon-icon-secondary, #575d60);

  &:active:not(.disabled) {
    color: orange;
  }

  &.disabled {
    cursor: not-allowed;
  }
}

:deep(.window-table) {
  tr:not([data-p-selected='true']):hover .direct-info {
    background-color: var(--component-table-bg-hover);
  }

  tr:not([data-p-selected='true']):hover .edit-window-name-icon {
    visibility: visible;
  }
}

.dotted-line {
  width: 30px;
  height: 1px;
  border-top: 1px dashed var(--colors-border-border-inactive, #c7d1d6);
}
</style>
