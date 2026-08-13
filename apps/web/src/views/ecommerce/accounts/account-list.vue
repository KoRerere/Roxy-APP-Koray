<script setup lang="tsx">
import { h } from 'vue'
import BrowserControl from './components/browser-control.vue'
import ClearCache from '/@/views/browser/list/profiles/components/clear-cache.vue'
import ExportProfiles from '/@/views/browser/list/profiles/components/export-profiles.vue'
import ProjectIcon from '/@/views/browser/list/profiles/components/project-icon.vue'
import TagsIcon from '/@/views/browser/list/profiles/components/tags-icon.vue'
import AdvancedSearch from '/@/views/browser/list/profiles/components/advanced-search.vue'
import TransferModal from '/@/views/browser/list/transfer/components/transfer-modal.vue'
import AccountFilters from './components/account-filters.vue'
import BindDevice from './components/bind-device.vue'
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
import { copyText, deepClone } from '/@/utils'
import { useMateGroup } from '/@/views/browser/create/hooks/useMate'
import { useTagsActions } from '/@/views/browser/list/tags/hook'
import { getAccountColumns } from './columns'
import { getAccountAdvancedSearch, getAccountFilters, getAccountOperation, getAccountSorts } from './operation'
import { switchWorkspaceAndToUpgradePlan } from '/@/hooks/useResponseToast/handleBusinessCode'
import { buildCustomFilterParamsFromMenu } from '/@/views/browser/list/profiles/utils/filterParams'
import { useDialog as RxUseDialog } from '/@/hooks/useDialog'
import { consumePendingEcommerceOpenGuide, hasPendingEcommerceOpenGuide, hasPendingEcommerceSkipCreateGuide } from '/@/domain/before-enter'
import { emitter, useEmitterEvent } from '/@/utils/eventBus'
import { useDrawer } from '/@/hooks/useDrawer'
import { useProfileProxy, useProfileProxySpeedTest } from '/@/views/browser/list/profiles/hooks/useProfileProxy'
import { useCookie } from '/@/views/browser/list/profiles/hooks/useCookie'
import { useTrack } from '/@/views/browser/list/profiles/hooks/useOperationTrack'
import { useProfileOpenState } from '/@/views/browser/list/profiles/hooks/useProfileOpenState'
import type { ProfileRow } from '/@/views/browser/list/profiles/hooks/useProfileOpenState'
import { useEcommerceAccountOpenGuide } from './hooks/useEcommerceAccountOpenGuide'
import { useEcommerceSkipCreateGuide } from './hooks/useEcommerceSkipCreateGuide'
import { hasBoundEcommerceDevice, useEcommerceAccountDeviceBind } from './hooks/useEcommerceAccountDeviceBind'
import { useProfilesTable } from '/@/views/browser/list/profiles/hooks/useProfilesTable'
import { useWindowModify } from '/@/views/browser/list/profiles/hooks/useWindowModify'
import { createProfileOperationHandler } from '/@/views/browser/list/profiles/operationHandlers'
import type { ProfileOperationDeps } from '/@/views/browser/list/profiles/operationHandlers'
import { LIST_CACHE_NAMESPACE, useListCacheActions, useListCacheStore } from '/@/stores/listCache'
import { useWorkspaceStore } from '/@/stores/workspace'
import useColumns from '/@/hooks/useColumns'
import { useOnboardingTaskStatus } from '/@/views/tutorial/hooks'

import type { UserGetWindowInfoListListData } from '@roxy/backend-api'

type Data = UserGetWindowInfoListListData['data']['rows'][number]

const props = withDefaults(defineProps<{
  isGroupProfile?: boolean
}>(), {
  isGroupProfile: false,
})

const route = useRoute()
const router = useRouter()
const confirm = useConfirm()
const dialog = useDialog()
const drawerInstance = useDrawer()
const { userInfo } = storeToRefs(useUserStore())
const { getProjects } = useMateGroup()
const [showModal] = RxUseDialog()
const [showToast, onlyErrorToast] = useResponseToast()
const [addTag] = useTagsActions()
const [show] = useContextMenu()
const { showSimpleDialog } = useSimpleDialog()
const { confirmDeleteProxy } = useProfileProxy()
const { runProxySpeedTestForRows } = useProfileProxySpeedTest()
const { editCookieByProfile, startCookieRobot } = useCookie()
const { saveLocalTrack } = useTrack()
const { check } = usePermission()
const workspaceStore = useWorkspaceStore()
const listCacheStore = useListCacheStore()
const { invalidateCache: invalidateAccountListCache } = useListCacheActions()
const { columns } = useColumns(getAccountColumns(), props.isGroupProfile ? ['project'] : undefined)
const { updateOnboardingTaskStatus } = useOnboardingTaskStatus()
const { openAccountDeviceSelectDrawer } = useEcommerceAccountDeviceBind()

const tableRef = useTemplateRef('table')
const tagsIconRef = useTemplateRef('tags')
const filtersMenu = ref<any[]>([])
const listInitialized = ref(false)
const advancedSearchOptions = getAccountAdvancedSearch()
// const checkerLoading = ref(false)

const {
  openMessage,
  workspaceName,
  listenOpenMessage,
  listenCloseMessage,
  listenCloseSyncingDataMessage,
  listenWebWindowManager,
  openBrowserBefore,
  getNotUsedProfiles,
  syncOpenedBrowserState,
  sendFirstOpenRecord,
} = useProfileOpenState()

const {
  dataList,
  hasFiltered,
  hasTempProfile,
  clearPendingAutoOpen,
  syncOpenedProxyToRow,
  onRefreshTable,
  tableRequest: baseTableRequest,
  syncFromCacheEntry,
} = useProfilesTable({
  tableRef,
  filtersMenu,
  getCurrentFilterParams: () => undefined,
  openBrowserBefore: openBrowserBefore as (data: Data | Data[]) => Promise<void>,
})

const { driverObj: openGuideDriverObj, driverNext: openGuideDriverNext, startGuide } = useEcommerceAccountOpenGuide({
  onComplete: () => {
    void updateOnboardingTaskStatus({ createProfileTourGuideStatus: true })
  },
})

const {
  driverObj: skipCreateGuideDriverObj,
  tryStartListGuide: tryStartSkipCreateGuide,
  finishGuideCompletely: finishSkipCreateGuide,
  notifyDeviceBindSuccess,
} = useEcommerceSkipCreateGuide({
  onComplete: () => {
    void updateOnboardingTaskStatus({ createProfileTourGuideStatus: true })
  },
})

const driverObj = computed(() => skipCreateGuideDriverObj.value ?? openGuideDriverObj.value)

function driverNext() {
  if (skipCreateGuideDriverObj.value)
    finishSkipCreateGuide()
  else
    openGuideDriverNext()
}

function mapAccountRow(item: Data) {
  return {
    ...item,
    projectName: item.projectName === '无项目' || item.projectName === $t('默认项目')
      ? $t('默认分组')
      : item.projectName,
  }
}

async function accountTableRequest(params: Record<string, unknown>) {
  const data = await baseTableRequest(params)
  if (data.code === 0) {
    data.data.rows = data.data.rows.map(mapAccountRow)
    dataList.value = data.data.rows
  }
  return data
}

function getAccountListCacheScope() {
  return props.isGroupProfile
    ? { projectId: String(route.params.id ?? '') }
    : { projectId: '' }
}

function invalidateAccountListCacheScope() {
  invalidateAccountListCache(LIST_CACHE_NAMESPACE.ECOMMERCE_ACCOUNT_LIST, getAccountListCacheScope())
}

function invalidateAndRefreshAccountList(params: Record<string, unknown> = {}, force = false) {
  invalidateAccountListCacheScope()
  onRefreshTable(params, force)
}

function getAccountCacheEntry() {
  const workspaceId = workspaceStore.currentWorkspace?.id
  if (!workspaceId)
    return null
  return listCacheStore.get(
    LIST_CACHE_NAMESPACE.ECOMMERCE_ACCOUNT_LIST,
    String(workspaceId),
    getAccountListCacheScope(),
  )
}

function shouldRestoreAccountListCache() {
  return !!getAccountCacheEntry()
}

function listCacheMeta() {
  const meta: Record<string, unknown> = {}
  if (filtersMenu.value.length)
    meta.filtersMenu = filtersMenu.value
  return meta
}

function tryRestoreAccountListFromCache() {
  if (!shouldRestoreAccountListCache())
    return false
  const entry = getAccountCacheEntry()
  if (!entry)
    return false
  syncFromCacheEntry(entry)
  dataList.value = (entry.rows as Data[]).map(mapAccountRow)
  return true
}

async function initializeAccountList() {
  if (listInitialized.value)
    return

  listInitialized.value = true
  filtersMenu.value = await getAccountFilters()

  const shouldStartOpenGuide = hasPendingEcommerceOpenGuide()
  const shouldStartSkipCreateGuide = hasPendingEcommerceSkipCreateGuide()

  if (shouldRestoreAccountListCache()) {
    tableRef.value?.restoreFromCache()
    tryRestoreAccountListFromCache()
    await nextTick()
  }
  else {
    await tableRef.value?.refresh({}, false)
  }

  // 跳过引导优先：与完整电商「打开」引导互斥
  if (shouldStartSkipCreateGuide)
    void tryStartSkipCreateGuide()
  else if (shouldStartOpenGuide)
    tryStartEcommerceOpenGuide()
}

function tryStartEcommerceOpenGuide() {
  if (!consumePendingEcommerceOpenGuide()) {
    console.warn('[EcommerceAccountOpenGuide] skipped: pending flag missing')
    return
  }
  // before-enter 已写入 pending，以此为准；后端 createProfileTourGuideStatus 可能默认为 true
  if (!dataList.value.some(row => !!row.id)) {
    console.warn('[EcommerceAccountOpenGuide] skipped: account list empty')
    return
  }
  void startGuide()
}

watch(() => route.params.id, async () => {
  if (!props.isGroupProfile)
    return
  listInitialized.value = false
  await nextTick()
  await initializeAccountList()
})

const { batchModifyWindow, singleModifyWindow, updateProfileMeta } = useWindowModify({
  onlyErrorToast,
  onRefreshTable,
  invalidateListCache: invalidateAccountListCacheScope,
})

let cancelOpenListener: (() => void) | undefined
let cancelCloseListener: (() => void) | undefined
let cancelCloseSyncingDataListener: (() => void) | undefined
let cancelWebWindowListener: (() => void) | undefined

useEmitterEvent('refreshProfileList', () => {
  invalidateAndRefreshAccountList()
})

onBeforeMount(() => {
  cancelOpenListener = listenOpenMessage({
    onOpenSuccess: (dirId) => {
      void syncOpenedProxyToRow(dirId)
    },
    onOpenFailed: clearPendingAutoOpen,
  })
  cancelCloseListener = listenCloseMessage()
  cancelCloseSyncingDataListener = listenCloseSyncingDataMessage()
  cancelWebWindowListener = listenWebWindowManager()

  void syncOpenedBrowserState()
  void nextTick(() => initializeAccountList())
})

onBeforeUnmount(() => {
  cancelOpenListener?.()
  cancelCloseListener?.()
  cancelCloseSyncingDataListener?.()
  cancelWebWindowListener?.()
})

function onAdvancedSearch(search?: Record<string, any>) {
  const { key, value } = search || {}
  onRefreshTable({ queryKey: value && (key || 'name_remark'), queryValue: value }, true)
}

async function onTestProxy(data: any) {
  const datas: Data[] = [].concat(data)
  const targets = datas.filter(row => row.proxyCategory !== 'noproxy')
  if (!targets.length) {
    onlyErrorToast(-1, $t('当前没有已绑定设备的账号'))
    return
  }
  await runProxySpeedTestForRows(targets)
}

// async function testAllProxy(silent = false) {
//   if (!check('Profiles_speed_test_proxy'))
//     return

//   if (!dataList.value?.length) {
//     !silent && onlyErrorToast(-1, $t('暂无账号'))
//     return
//   }

//   const targets = dataList.value.filter(row => row.proxyCategory !== 'noproxy')
//   if (!targets.length) {
//     !silent && onlyErrorToast(-1, $t('当前没有已绑定设备的账号'))
//     return
//   }

//   if (checkerLoading.value)
//     return
//   checkerLoading.value = true
//   await runProxySpeedTestForRows(targets, { showConcurrentTaskTopBar: !silent, silent })
//   checkerLoading.value = false
// }

const baseOperationHandler = createProfileOperationHandler({
  saveLocalTrack,
  tableRef,
  filtersMenu,
  router,
  route,
  getCurrentFilter: () => undefined,
  copyTextFn: copyText,
  showToast,
  onTransfer,
  onMoveToProject,
  openBrowserBefore,
  setAsDefaultBrowser,
  createDesktopShortcut,
  multipleProxyChange,
  multipleProxyDelete: confirmDeleteProxy,
  multipleAccountChange: async () => { },
  tagsIconRef,
  addTag,
  updateProfileMeta,
  singleModifyWindow,
  onRemark: async () => { },
  onEditCookies,
  openCookieRobot,
  onClearCache,
  exportProfile,
  deleteProfile,
  onTestProxy,
} as ProfileOperationDeps)

async function operationHandler(operate: any, data: any, operationType: 'single' | 'batch' = 'single') {
  if (operate.name === 'edit') {
    const { page_index } = tableRef.value?.getParams() ?? {}
    router.push({
      name: 'ecommerce-account-edit',
      query: {
        id: data.id,
        page_index,
        ...(props.isGroupProfile ? { title: route.query.title } : {}),
        customFilterParams: JSON.stringify(buildCustomFilterParamsFromMenu(filtersMenu.value)),
      },
    })
    return
  }
  await baseOperationHandler(operate, data, operationType)
}

function showOperationMenu(props: { event: Event, operation: any[] }, data: any) {
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
}

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

async function onTransfer(datas: Data[], operate?: any) {
  const { code } = await API.pay.userCheckTeamUserRightsList()
  if (code !== 0) {
    if (!check('Cost_Center_all')) {
      emitter.emit('showToast', {
        severity: 'warn',
        life: 5000,
        summary: $t('账号转移不可用'),
        detail: (
          <I18nT keypath={$t('账号转移不可用，请联系团队的拥有者进行升级，或{link}以激活该跨团队功能。', { link: '{link}' })}>
            {{ link: () => <a class="cursor-pointer" onClick={switchWorkspaceAndToUpgradePlan}>{$t('前往升级您的权益')}</a> }}
          </I18nT>
        ),
      })
      return
    }

    if (operate?._event && ['quick', 'batch_quick'].includes(operate._type)) {
      emitter.emit('showPayWall', {
        event: operate._event,
        params: { type: 'transfer' },
      })
    }
    else {
      emitter.emit('showToast', {
        severity: 'warn',
        life: 5000,
        summary: $t('账号转移不可用'),
        detail: (
          <I18nT keypath={$t('账号转移为 Roxy 会员功能，{link}以解锁', { link: '{link}' })}>
            {{ link: () => <a class="cursor-pointer" onClick={switchWorkspaceAndToUpgradePlan}>{$t('单击此处升级')}</a> }}
          </I18nT>
        ),
      })
    }
    return
  }

  const result = await getNotUsedProfiles(datas as ProfileRow[])
  if (result.length !== datas.length) {
    onlyErrorToast(-1, $t('当前已打开的账号无法被转移'))
    return
  }

  const { promise, resolve, reject } = Promise.withResolvers<void>()
  showModal({
    showHeader: false,
    modal: true,
    blockScroll: true,
    pt: { content: '!pa-0' },
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
            showToast(0, $t('未接受或被拒绝的账号将在24小时内自动返回。'))
          }
          else {
            if (needRefresh)
              invalidateAndRefreshAccountList()
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
  const datas: Data[] = [].concat(data)
  const { promise, resolve, reject } = Promise.withResolvers<void>()

  const names = datas.slice(0, 10).map(item => `${workspaceName.value}-${item.windowSortNum}`).join(', ')
  const namesStr = `[${names}${datas.length > 10 ? '...' : ''}]`

  showSimpleDialog({
    title: $t('移动到分组'),
    content: $t('将移动 {names} 到所选分组', { names: namesStr }),
    inputs: [
      {
        type: 'select',
        name: 'projectId',
        props: {
          placeholder: $t('请选择分组'),
          options,
          optionValue: 'value',
        },
        resolver: (z: any) => z.string({
          invalid_type_error: $t('请选择分组'),
        }).min(1, $t('请选择分组')),
      },
    ],
    onConfirm: async (formData: any) => {
      if (formData.projectId) {
        const ids = datas.filter(item => item.projectId !== Number(formData.projectId)).map(item => item.id)
        if (!ids.length) {
          onlyErrorToast(-1, $t('所选账号 {names} 已在该分组中', { names: namesStr }))
          return
        }

        await batchModifyWindow({ ids, projectId: formData.projectId, requestType: ProfileReqType.MoveProject }, !props.isGroupProfile)
          .then(() => {
            const projectName = options.find(item => item.value === formData.projectId)!.label
            datas.forEach((item) => {
              item.projectName = projectName === '无项目' ? $t('默认分组') : projectName
              item.projectId = Number(formData.projectId)
              item.labelInfo = item.labelInfo!.filter((it: any) => !it.labelId.startsWith?.('u_'))
              item.labelIds = item.labelInfo!.map((it: any) => it.labelId)
            })
            invalidateAccountListCache(LIST_CACHE_NAMESPACE.ECOMMERCE_ACCOUNT_LIST, { projectId: String(formData.projectId) })
            if (props.isGroupProfile)
              invalidateAccountListCacheScope()
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

  if (operationType === 'batch') {
    onlyErrorToast(-1, $t('暂不支持批量更换设备'))
    resolve()
    return promise
  }

  const account = ([] as Data[]).concat(data)[0]
  if (!account) {
    resolve()
    return promise
  }

  openAccountDeviceSelectDrawer(account, {
    proxyMethod,
    onHide: resolve,
    onSuccess: () => notifyDeviceBindSuccess(),
  })
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
        paramList: { cookie },
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
  startCookieRobot([].concat(data as any))
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
        title: $t('清空账号缓存'),
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
  const result = await getNotUsedProfiles(datas as ProfileRow[])
  if (result.length !== datas.length) {
    onlyErrorToast(-1, $t('请先关闭账号'))
    return
  }

  const windowStatus = ids.map(id => ({ id, openStatus: false }))
  await API.window.userMdfWindowSyncV2Create(windowStatus)

  const usePeoples = datas.some((item: any) => item.statusInfo.some((status: any) => status.openUserId !== userInfo.value.id))
  if (usePeoples) {
    onlyErrorToast(-1, $t('无法删除正在被其他成员使用的账号'))
    return
  }

  const { promise, resolve, reject } = Promise.withResolvers<void>()
  confirm.require({
    header: $t('警告'),
    message: $t('此操作无法撤销，您确认要删除所选账号吗？'),
    rejectProps: {
      label: $t('取消'),
      severity: 'secondary',
      outlined: true,
    },
    acceptProps: {
      label: $t('确认'),
      severity: 'danger',
    },
    async accept() {
      const { code, msg } = await API.window.userDelWindowInfoCreate({ ids })
      onlyErrorToast(code, msg)
      if (code !== 0)
        return reject(msg)
      invalidateAndRefreshAccountList()
      globalThis.electronAPI.send('browser:batchRemove', datas.map((item: any) => item.dirId))
      resolve()
    },
    reject,
    onHide: reject,
  } as any)

  return promise
}

function toCreateAccount() {
  router.push({
    name: 'ecommerce-account-create',
    query: props.isGroupProfile
      ? { projectId: String(route.params.id) }
      : undefined,
  })
}

/** 列表未绑定设备时，走与操作菜单相同的选择设备流程 */
function onChooseDevice(data: Data) {
  if (!check('Profiles_select_proxy'))
    return
  void operationHandler({ name: 'chooseProxy' }, data)
}

defineExpose({
  tableRef,
})
</script>

<template>
  <RyTable ref="table" v-model:columns="columns" cache-key="ecommerce-account-list" :list-cache-key="LIST_CACHE_NAMESPACE.ECOMMERCE_ACCOUNT_LIST" :list-cache-scope="getAccountListCacheScope"
           :list-cache-meta="listCacheMeta" :list-cache-should-restore="shouldRestoreAccountListCache" :immediate="false" skeleton :table-sort="getAccountSorts" :table-request="accountTableRequest"
           :table-operation="getAccountOperation" :operation-handler="operationHandler" selection-mode="multiple" :show-actions="false" :virtual-scroller-options="{ itemSize: 60 }" class="account-table"
           removable-sort
  >
    <template #filter-after>
      <div class="w-full flex items-start gap-2">
        <AdvancedSearch :options="advancedSearchOptions" :search="onAdvancedSearch" :clear="onAdvancedSearch" />
        <!-- <RxDivider class="py-1" vertical line-only /> -->
        <AccountFilters :filters-menu="filtersMenu" @filter-change="onRefreshTable()" />
        <!-- <RxButton v-if="check('Profiles_speed_test_proxy')" size="xxs" outlined severity="secondary" icon="base/rx_ic_speed_test" :label="$t('测试全部设备')" @click.stop="testAllProxy()" /> -->
      </div>
    </template>
    <template #table-empty>
      <CustomEmpty v-if="hasFiltered" icon="rx_illustration_filter.svg" :title="$t('暂无查询结果')" :desc="$t('当前条件下没有匹配的结果，请尝试更换其他筛选条件。')" />
      <CustomNewEmpty v-else icon="base/rx_ic_browser" img="empty-account.png" :title="$t('暂无账号')" :desc="$t('账号是电商模式的核心管理单元，可用于统一管理浏览器环境与业务配置。')">
        <template #extra>
          <RxButton v-if="check('Profiles_add')" severity="secondary" size="md" icon="base/rx_ic_browser_add" variant="outlined" :label="$t('创建账号')" @click.stop="toCreateAccount" />
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
                  {{ $t('临时账号在过期前不占用您的账号用量，可以正常使用。过期后将会占用您的账号用量。用量不足将无法打开账号。') }}
                </div>
              </div>
            </template>
          </RxTooltip>
        </template>
      </Column>
    </template>
    <template #bindDevice="{ data, index }">
      <template v-if="data.id">
        <BindDevice v-if="hasBoundEcommerceDevice(data)" :data="data" />
        <RxButton v-else :id="`BIND_DEVICE_${index}`" size="xxs" outlined severity="secondary" icon="base/rx_ic_internet" :label="$t('绑定设备')" @click.stop="onChooseDevice(data)" />
      </template>
      <template v-else>
        <Skeleton width="120px" height="24px" border-radius="4px" />
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
    <template #project="{ data }">
      <template v-if="data.id">
        <ProjectIcon :disabled="!check('Profiles_move_project')" :labels="data.labelInfo" :project-id="data.projectId" :project-name="data.projectName" @update="updateProfileMeta($event, data)" />
      </template>
      <template v-else>
        <Skeleton width="100px" height="20px" border-radius="4px" />
      </template>
    </template>
    <template #operation="{ data, index }">
      <div class="flex items-center gap-2">
        <template v-if="!data.id">
          <Skeleton width="70px" height="24px" border-radius="4px" />
          <template v-for="i in 2" :key="i">
            <Skeleton width="24px" height="24px" border-radius="4px" />
          </template>
        </template>
        <template v-else>
          <BrowserControl :btn-id="`OPEN_${index}`" :data="data" :open-message="openMessage" :driver-obj="driverObj" :driver-next="driverNext" :send-first-open-record="sendFirstOpenRecord"
                          :icon="data.coreType === CoreType.Firefox ? 'base/rx_ic_firefox' : 'base/rx_ic_chrome'" @open="openBrowserBefore"
          />
          <Actions :operation="getAccountOperation(data)" :loading-operation-map="data.loadingOperationMap" @quick-click="operationHandler($event, data)" @more="showOperationMenu($event, data)" />
        </template>
      </div>
    </template>
  </RyTable>
  <TagsIcon ref="tags" class="!hidden" :labels="[]" :show-create-tag="false" @update="updateProfileMeta($event, tableRef?.selectionData)" />
</template>

<style lang="scss" scoped>
.bind-device-empty {
  color: var(--colors-text-text-brand);
  font-size: 13px;
  line-height: 20px;
  cursor: pointer;

  &--disabled {
    color: var(--colors-text-text-tertiary);
    cursor: not-allowed;
  }
}

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
</style>
