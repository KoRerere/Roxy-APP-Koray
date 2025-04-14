<!-- eslint-disable ts/ban-ts-comment -->
<script setup lang="ts">
import { useConfirm } from 'primevue/useconfirm'
import { useDialog } from 'primevue/usedialog'
import { useTemplateRef } from 'vue'
import { API } from '/@/api'
import { useContextMenu } from '/@/components/rx-ctxmenu'
import { RxSvgIcon } from '/@/components/rx-icon/'
import Popup from '/@/components/simplePopup'
import { ClearType, ProfileOpenStatus, ProxyCheckStatus } from '/@/enums'
import useColumns from '/@/hooks/useColumns'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { $t } from '/@/locales'
import { useRoleStore } from '/@/stores/role'
import { useUserStore } from '/@/stores/user'
import { useWorkspaceStore } from '/@/stores/workspace'
import { copyText, createDefaultObject, filterFieldByValue, getFormData, isEmptyValue, deepClone } from '/@/utils'
import { useCheckProxy } from '/@/views/agent/hooks'
import { useMateGroup } from '/@/views/browser/create/hooks/useMate'
import { useTagsActions } from '/@/views/browser/list/tags/hook'
import { getColumns } from './columns'
import BrowserControl from './components/browser-control.vue'
import ClearCache from './components/clear-cache.vue'
import CustomFilters from './components/custom-filters.vue'
import DrawersTtems from './components/drawers-item.vue'
import EditCookies from './components/edit-cookies.vue'
import ExportProfiles from './components/export-profiles.vue'
import ProfileInfo from './components/profile-info.vue'
import ProjectIcon from './components/project-icon.vue'
import TagsIcon from './components/tags-icon.vue'
import TransferModal from '/@/views/browser/list/transfer/transfer-modal.vue'
import { getCustomFilters, getOperation, getSorts } from './operation'
import { useHandleBusinessCode } from '/@/hooks/useResponseToast/handleBusinessCode'
import type { UserGetWindowInfoListListData } from '@roxy/backend-api'
import { useDialog as RxUseDialog } from '/@/hooks/useDialog'
import { emitter } from '/@/utils/eventBus'
import { showToast as wcisToast } from "/@/hooks/useResponseToast/handleBusinessCode";
import { I18nT } from "vue-i18n"


type Data = UserGetWindowInfoListListData['data']['rows'][number]

const props = defineProps({
  currentFilter: {
    type: Object,
    default: undefined,
  },
  isProjectProfile: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['updateFilterTabs', 'switchTab'])

const route = useRoute()
const router = useRouter()
const confirm = useConfirm()
const dialog = useDialog()
const role = useRoleStore()
const workspaceStore = useWorkspaceStore()
const { handleBusinessCode } = useHandleBusinessCode()
const [dialogInstance] = RxUseDialog()
const { userInfo, isNoPayUser } = storeToRefs(useUserStore())
const { getProjects } = useMateGroup()
const [checkProxy] = useCheckProxy()
const [showToast, onlyErrorToast] = useResponseToast()
const [addTag] = useTagsActions({ toast: false })
const [show] = useContextMenu()
const tableRef = useTemplateRef('windownTable')
const tagsIconRef = useTemplateRef('tagsIcon')
const [columns] = useColumns(getColumns(), props.isProjectProfile ? ['project'] : undefined)

const filtersMenu = ref()
const openMessage = reactive<any>({})
const hasFiltered = ref(false)

const operation = computed(getOperation)

const drawer = reactive({
  type: 'proxyList',
  title: '',
  data: null,
  visible: false,
  dismissable: false,
  confirm: (type: any, data: any) => {
    const { id, dirId, windowPlatformList } = drawer.data!
    switch (type) {
      case 'proxyForm': {
        drawer.updateProfile({ ...data, id, dirId, moduleId: 0, proxyMethod: 'custom' })
        break
      }
      case 'proxyList': {
        drawer.updateProfile({ id, dirId, moduleId: data.id, proxyMethod: 'choose' })
        break
      }
      case 'accountForm': {
        data._tempId = (new Date().getTime()).toString(32)
        const _windowPlatformList = (windowPlatformList as any[]).concat(data)
        drawer.updateProfile({ id, dirId, windowPlatformList: _windowPlatformList })
        break
      }
      case 'accountList': {
        const platformUrlIds = data.map((item: any) => item.id).filter(Boolean)
        drawer.updateProfile({ id, dirId, platformUrlIds })
        break
      }
      case 'editCookies': {
        drawer.updateProfile({ id, cookie: data })
        break
      }
    }
  },
  updateProfile: async (data: any) => {
    await singleModifyWindow(data)
    drawer.visible = false
  },
})

watch(() => props.currentFilter, (value: any) => {
  if (value) {
    getCustomFilters(value.filter_condition || {})
      .then((data) => {
        filtersMenu.value = data
        onRefreshTable(value._params)
      })
  }
})

watch(
  () => route.params.id,
  () => {
    if (route.params.id) {
      tableRef.value?.refresh()
    }
  },
)

const workspaceName = computed(() => workspaceStore.currentWorkspace?.workspaceName?.slice(0, 3).toLocaleUpperCase())

function onRefreshTable(tabParams = {}, force = false) {
  const params = {
    ...props.currentFilter?._params,
    ...tabParams,
    ...filterFieldByValue(getFormData(filtersMenu.value)),
  }
  hasFiltered.value = !isEmptyValue(params)
  tableRef.value?.refresh(params, force)
}

async function saveFilters(formData: any) {
  if (!filtersMenu.value.some((item: any) => item.value)) {
    return
  }
  const { filter_name, filter_rule, sort } = formData

  const filter_condition = filtersMenu.value.reduce((acc: any, cur: any) => {
    if (cur.value) {
      acc[cur.name] = toRaw(cur.value)
    }
    return acc
  }, {})

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
  showToast(code, msg)
}

// async function coverDefaultDisplay() {
//   warnPopup('此操作将会覆盖所有已保存的筛选条件的Display, 是否继续?')
//     .then(() => { })
// }

async function tableRequest(params: any) {
  // 0: 未删除
  const data = await API.window.userGetWindowInfoListList({ projectIds: route.params.id, ...params, isDelete: 0 })
  const rows = (data.data?.rows || []).map(item => ({
    ...item,
    projectName: item.projectName === '无项目' ? $t('默认项目') : item.projectName,
  }))
  autoOpenBrowser(rows)
  data.data.rows = rows
  return data
}

async function operationHandler(operate: any, data: any, operationType: 'single' | 'batch' = 'single') {
  /**
   * 兼容批量操作
   */
  const datas: Data[] = [].concat(data).map(item => toRaw(item))
  const ids = datas.map(item => item.id!)

  switch (operate.name) {
    case 'edit':
      const [{ page_index }] = tableRef.value!.getParams()
      const customFilterParams = filtersMenu.value.reduce((acc: any, cur: any) => {
        if (cur.value) {
          acc[cur.name] = toRaw(cur.value)
        }
        return acc
      }, {})
      router.push({
        name: 'browser-edit',
        query: {
          ...route.query,
          id: data.id,
          page_index,
          activeTabId: props.currentFilter?.id,
          customFilterParams: JSON.stringify(customFilterParams)
        }
      })
      break
    case 'copyId':
      copyText(data.dirId)
      showToast(0, $t('复制成功'))
      break
    case 'transfer':
      await onTransfer(datas, operate)
      break
    case 'moveToProject':
      await onMoveToProject(datas)
      break
    case 'open':
    case 'view':
      await openBrowserBefore(data)
      break
    case 'restart':
      const dirIds = datas.filter(item => item.openLimitStatus).toSorted((a, b) => a.windowSortNum! - b.windowSortNum!).map(item => item.dirId!)
      if (dirIds.length) {
        window.electronAPI.send('browser:batchRelaunch', dirIds)
      }
      break
    case 'close':
      window.electronAPI.send('browser:batchClose', datas.map((item: any) => item.dirId))
      break
    case 'addTag':
      if (operationType === 'batch') {
        tagsIconRef.value?.openMenu(operate._event)
      } else {
        addTag({
          confirmNext: ({ res }: any) => {
            updateMeta({ labelIds: [...data.labelIds, res.data.id] }, ids)
          },
        })
      }
      break
    case 'fav':
      singleModifyWindow({ id: data.id, isOften: !data.isOften })
      break
    case 'addNotes':
      await onRemark(datas)
      break
    case 'editCookies':
      drawer.visible = true
      drawer.data = data
      drawer.type = 'editCookies'
      drawer.title = $t('为[{workspaceName}-{uid}]编辑 Cookies', { workspaceName: workspaceName.value, uid: data.windowSortNum })
      break
    case 'clearCache':
      onClearCache(data)
      break
    case 'exportProfile':
      exportProfile(datas)
      break
    case 'delete':
      await deleteProfile(datas, ids)
      break
  }
}

function autoOpenBrowser(list: Data[]) {
  const query = route.query.browser && JSON.parse(route.query.browser as string)
  if (query?.openBrowser) {
    const data = list.find(item => item.id === query.windowId)
    router.replace({ name: route.name })
    if (data) {
      openBrowserBefore(data)
    }
  }
}

async function openBrowserBefore(data: Data | Data[]) {
  //过滤打开限制的 profile
  const datas = ([] as Data[]).concat(data)
    .filter(item => item.openLimitStatus)
    .toSorted((a, b) => a.windowSortNum! - b.windowSortNum!)

  if (!datas.length) {
    return
  }

  datas.forEach((item, index) => {
    Reflect.set(openMessage, item.dirId!, {
      pending: true,
      data: {
        message: `${index === 0 ? $t('启动中...') : $t('等待中...')}`
      }
    })
  })

  const result = await checkProfileStatus(datas)
  //过滤自身打开的窗口
  const list = result.filter(item => !item.statusInfo.some(info => info.openUserId === userInfo.value.id))
  // 1.如果没有其他人打开窗口，则直接打开
  if (!list.length) {
    onOpenBrowser(datas)
    return
  }

  // 2.如果窗口其他人打开了，那么就提示用户，让用户选择是否继续打开
  confirm.require({
    header: $t('警告'),
    message: $t('[{names}] 已被其他成员打开，是否继续打开？', { names: result.map(item => `${workspaceName.value}-${item.sortNum}`).join(', ') }),
    rejectProps: {
      label: $t('取消'),
      severity: 'secondary',
      outlined: true,
    },
    acceptProps: {
      label: $t('确认'),
      severity: 'info',
    },
    accept: async () => {
      onOpenBrowser(datas)
    },
    reject: async () => {
      datas.forEach(item => {
        Reflect.deleteProperty(openMessage, item.dirId!)
      })
    },
  })
}

async function checkProfileStatus(datas: Data[]) {
  const ids = datas.map(item => item.id!)
  const { data } = await API.window.userGetWindowStatusInfoCreate({ ids })
  return data.filter(item => item.openStatus === ProfileOpenStatus.opened)
}

function onOpenBrowser(datas: Data[]) {
  const dirIds = datas.map(item => item.dirId!)
  if (dirIds.length) {
    window.electronAPI.send('browser:batchLaunch', dirIds)
  }
}

function showOperationMenu({ event, operation }: { event: Event, operation: any }, data: any) {
  show(event, {
    operation,
    operationHandler: async (operate: any) => {
      try {
        const _operate = { ...deepClone(toRaw(operate)), _event: event }
        await operationHandler(_operate, data)
      }
      catch (error) {
        console.log(error)
      }
    },
  })
}

async function updateMeta(params: { labelIds?: number[], projectId?: number }, ids: number[], type?: 'single' | 'batch') {
  // why? 当标签关联人员的时候，需要调单个修改窗口的接口
  if (type === 'single') {
    await singleModifyWindow({ ...params, id: ids[0] })
  } else {
    await batchModifyWindow({ ...params, ids })
  }
}

async function onTransfer(datas: Data[], operate?: any) {
  if (isNoPayUser.value) {
    if (!role.isOwner) {
      wcisToast({
        severity: 'warn',
        summary: $t('窗口投送不可用'),
        detail: $t('请联系空间的拥有者进行升级。'),
        life: 5000
      })
      return
    }

    if (operate._event && ['quick', 'batch_quick'].includes(operate._type)) {
      emitter.emit("showPayWall", {
        event: operate._event,
        params: {
          type: "transfer",
        },
      })
    } else {
      wcisToast({
        severity: 'warn',
        summary: $t('窗口投送不可用'),
        detail: h(I18nT, {
          keypath: $t('窗口投送为 Roxy 会员功能，{link}以解锁', { link: '{link}' }),
        }, {
          link: () => h('a', {
            class: 'cursor-pointer',
            onClick: () => router.push({ name: 'subscribe-plan' }),
          }, $t('升级会员'))
        }),
        life: 5000
      })
    }
    return
  }

  const { promise, resolve, reject } = Promise.withResolvers<void>();
  dialogInstance.showModal({
    showHeader: false,
    modal: true,
    blockScroll: true,
    innerDialog: true,
    pt: {
      content: '!pa-0'
    },
    slots: {
      container: () => h(TransferModal, {
        ids: datas.map(item => item.id!),
        onClose: () => {
          dialogInstance.hideModal()
          reject()
        },
        onConfirm: async ({ isSelf, needRefresh }: Record<string, boolean>) => {
          dialogInstance.hideModal()
          if (!isSelf) {
            showToast(0, $t('未接受或被拒绝的窗口将在24小时内自动返回。'))
            router.replace({ name: 'browser-list', query: { activeTabId: 'rx_1004' } })// 投送成功后，切换到投送中 tab
            emit('switchTab', 'rx_1004')
          } else {
            if (needRefresh) {
              onRefreshTable()
            }
            showToast(0, $t('投送成功'))
          }
          resolve()
        },
      })
    }
  })
  return promise
}

async function onMoveToProject(datas: any) {
  const options = await getProjects()

  return new Promise((resolve, reject) => {
    const names = datas.slice(0, 10).map((item: any) => `${workspaceName.value}-${item.windowSortNum}`).join(', ')
    const namesStr = `[${names}${datas.length > 10 ? '...' : ''}]`

    dialog.open(Popup, {
      props: {
        showHeader: false,
        modal: true,
        blockScroll: true,
      },
      data: {
        props: {
          title: $t('移动项目'),
          content: $t('将移动 {names} 到所选项目', { names: namesStr }),
          inputs: [
            {
              type: 'select',
              name: 'projectId',
              placeholder: $t('请选择项目'),
              options,
              filter: false,
              optionsValue: 'value',
            },
          ],
        },
        onConfirm: async (formData: any) => {
          if (formData.projectId) {
            const ids = datas.filter((item: any) => item.projectId !== Number(formData.projectId)).map((item: any) => item.id)
            if (!ids.length) {
              onlyErrorToast(-1, $t('所选窗口 {names} 已在该项目中', { names: namesStr }))
              return
            }
            await batchModifyWindow({ ids, projectId: formData.projectId })
          }
          resolve(true)
        },
        onCancel: () => {
          reject($t('取消'))
        },
      },
    })
  })
}

async function onRemark(datas: any) {
  return new Promise((resolve, reject) => {
    dialog.open(Popup, {
      props: {
        showHeader: false,
        modal: true,
        blockScroll: true,
      },
      data: {
        props: {
          title: $t('为所选窗口添加备注'),
          inputs: [
            {
              type: 'textarea',
              name: 'windowRemark',
              placeholder: $t('请输入备注'),
              value: datas[0].windowRemark,
              rows: 5
            },
          ],
        },
        onConfirm: async (formData: any) => {
          const ids = datas.map((item: any) => item.id)
          await batchModifyWindow({ ids, windowRemark: formData.windowRemark })
          resolve(true)
        },
        onCancel: () => {
          reject($t('取消'))
        },
      },
    })
  })
}

async function onClearCache(data: any) {
  dialog.open(ClearCache, {
    props: {
      showHeader: false,
      modal: true,
      blockScroll: true,
    },
    data: {
      props: {
        title: $t('清空窗口 [{name}] 缓存', { name: `${workspaceName.value}-${data.windowSortNum}` }),
        content: $t('清除时系统会自动关闭窗口，且可能导致登录状态失效'),
      },
      onConfirm: async (result: ClearType) => {
        if (result === ClearType.cloud) {
          await API.window.userClearWindowCacheCreate({ ids: [data.id] })
          await electronAPI.send('browser:clearCache', { clearType: ClearType.all, dirId: data.dirId })
        }
        else {
          await electronAPI.send('browser:clearCache', { clearType: result, dirId: data.dirId })
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
      }
    },
  })
}

async function deleteProfile(datas: any, ids: number[]) {
  if (datas.some((item: any) => Reflect.has(openMessage, item.dirId))) {
    const result = await electronAPI.send('browser:isProcessExists', datas.map((item: any) => item.dirId))
    console.log('browser:isProcessExists result', result)
    if (result.some(item => item)) {
      onlyErrorToast(-1, $t('请先关闭窗口'))
      return
    }
  }

  return new Promise((resolve, reject) => {
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
      checkboxProps: {
        label: $t('彻底删除'),
        value: false,
      },
      async accept() {
        if (this.checkboxProps.value) {
          await API.window.userDelWindowInfoCreate({ ids })
          onRefreshTable()
          electronAPI.send('browser:batchRemove', datas.map((item: any) => item.dirId))
        } else {
          await batchModifyWindow({ ids, isDelete: true })
        }

        resolve(true)
      },
      reject: () => {
        reject($t('取消'))
      },
    } as any)
  })
}

async function singleModifyWindow(params: any) {
  try {
    const { code, msg } = await API.window.userMdfWindowInfoSingleV2Create(params)
    showToast(code, msg)
    if (code === 0) {
      onRefreshTable()
    }
  }
  catch (error) {
    onlyErrorToast(-1, error as string)
  }
}

async function batchModifyWindow(params: any) {
  try {
    const { code, msg } = await API.window.userMdfWindowInfoBatchV2Create(params)
    showToast(code, msg)
    if (code === 0) {
      onRefreshTable()
      return Promise.resolve()
    }
  }
  catch (error) {
    onlyErrorToast(-1, error as string)
    return Promise.reject(error)
  }
}

/**
 * profile =================
 */
function profileOperate(key: string, data: any) {
  const _data = toRaw(data)
  console.log('profileOperate', key, _data)
  drawer.data = _data
  switch (key) {
    case 'addProxy':
      drawer.visible = true
      drawer.type = 'proxyForm'
      drawer.title = $t('为[{workspaceName}-{uid}]添加代理', { workspaceName: workspaceName.value, uid: data.windowSortNum })
      break
    case 'editProxy':
      drawer.visible = true
      drawer.type = 'proxyForm'
      drawer.title = $t('为[{workspaceName}-{uid}]编辑代理', { workspaceName: workspaceName.value, uid: data.windowSortNum })
      break
    case 'selectProxy':
      drawer.visible = true
      drawer.type = 'proxyList'
      drawer.title = $t('为[{workspaceName}-{uid}]选择代理', { workspaceName: workspaceName.value, uid: data.windowSortNum })
      break
    case 'testProxy':
      testProxy(_data)
      break
    case 'refreshUrl':
      refreshUrl(_data)
      break
    case 'deleteProxy':
      deleteProxy(_data)
      break
    case 'addAccount':
      drawer.visible = true
      drawer.type = 'accountForm'
      drawer.title = $t('为[{workspaceName}-{uid}]添加平台账号', { workspaceName: workspaceName.value, uid: data.windowSortNum })
      break
    case 'selectAccount':
      drawer.visible = true
      drawer.type = 'accountList'
      drawer.title = $t('为[{workspaceName}-{uid}]选择平台账号', { workspaceName: workspaceName.value, uid: data.windowSortNum })
      break
    case 'saveWindowName':
      singleModifyWindow({
        id: _data.id,
        windowName: _data.windowName,
      })
      break
  }
}

async function testProxy(data: any) {
  const checkRes = await checkProxy(toRaw(data))

  if (data.moduleId) {
    await API.proxy.userMdfProxyModuleCreate([{ id: data.moduleId, ...checkRes }] as any)
  }

  if (checkRes.checkStatus === ProxyCheckStatus.success) {
    singleModifyWindow({ id: data.id, dirId: data.dirId, ...checkRes })
  }
}

async function refreshUrl(data: any) {
  const isOK = await window.electronAPI.send('proxy:refreshUrl', data.refreshUrl)
  showToast(isOK ? 0 : -1, data.refreshUrl)
}

async function deleteProxy(data: any) {
  confirm.require({
    header: $t('删除代理'),
    message: $t('您确认要删除代理吗？'),
    rejectProps: {
      label: $t('取消'),
      severity: 'secondary',
      outlined: true,
    },
    acceptProps: {
      label: $t('确认'),
      severity: 'danger',
    },
    accept: () => {
      // 删除代理也是调用修改接口
      singleModifyWindow({
        id: data.id,
        dirId: data.dirId,
        moduleId: 0, // 为0表示解除关联
        proxyCategory: 'noproxy',
        proxyMethod: 'custom',
        ...createDefaultObject(['host', 'ipType', 'port', 'proxyPassword', 'proxyUserName', 'refreshUrl'] as const, ''),
      })
    },
  })
}

function listenOpenMessage() {
  return window.electronAPI.on('browser:launch-process-message', (event) => {
    const id = event.data?.dirId || event.data
    Reflect.set(openMessage, id as string, event)
  })
}

function listenCloseMessage() {
  return window.electronAPI.on('browser:on-close', (dirId) => {
    Reflect.deleteProperty(openMessage, dirId)
  })
}

async function toCreateBrowser() {
  const { code, msg } = await API.window.userCheckWindowTotalCountList()
  if (code === 0) {
    router.push({ name: 'browser-create', query: { projectId: route.params.id } })
  } else {
    handleBusinessCode(code, () => {
      showToast(code, msg)
    })
  }
}

let canceOpenlListener: any
let canceCloselListener: any
onBeforeMount(() => {
  canceOpenlListener = listenOpenMessage()
  canceCloselListener = listenCloseMessage()

  window.electronAPI
    .send('browser:getOpenedBrowserMessage')
    .then((state) => {
      console.log('browser:getOpenedBrowserMessage state', state)
      state.forEach((item: any) => {
        Reflect.set(openMessage, item.dirId, { data: item })
      })
    })

  let customFilterParams = {}
  try {
    customFilterParams = JSON.parse(route.query.customFilterParams as string)
  } catch (error) {
    // console.log('parse customFilterParams error',error)
  }

  getCustomFilters(customFilterParams).then((data) => {
    filtersMenu.value ??= data
  }).finally(() => {
    onRefreshTable(customFilterParams, false)
  })
})

onBeforeUnmount(() => {
  canceOpenlListener?.()
  canceCloselListener?.()
})

defineExpose({
  tableRef,
})
</script>

<template>
  <RyTable ref="windownTable" v-model:columns="columns" cacheKey="browser-list" :immediate="false" :table-sort="getSorts" :table-request="tableRequest" :operation="operation"
    :operation-handler="operationHandler" selection-mode="multiple" :show-actions="false" :virtualScrollerOptions="{ itemSize: 60 }" class="window-table">
    <template #filter-after>
      <CustomFilters :current-filter="currentFilter" :filters-menu="filtersMenu" :enabled-filter-save="!isProjectProfile" :save-filters="saveFilters" @filter-change="onRefreshTable" />
    </template>
    <template #table-empty>
      <CustomEmpty v-if="hasFiltered" icon="rx_illustration_filter.svg" :title="$t('暂无查询结果')" :desc="$t('当前条件下没有匹配的结果，请尝试更换其他筛选条件。')" />
      <CustomEmpty v-else icon="rx_illustration_roxybrowser.png" :title="$t('暂无窗口')" :desc="$t('窗口是 RoxyBrowser 的核心功能，可以帮助您管理多个浏览器窗口，并为它们设置不同的项目、平台账号、代理等，以方便您更好地执行业务操作。')">
        <template #extra>
          <div class="flex items-center gap-3">
            <RxButton v-if="!role.isViewer" outlined severity="secondary" size="xs" icon="base/rx_ic_browser_add" :label="$t('创建窗口')" @click.stop="toCreateBrowser" />
          </div>
        </template>
      </CustomEmpty>
    </template>
    <template #profile="{ data }">
      <ProfileInfo :workspace-name="workspaceName!" :data="data" :open-message="openMessage" @profile-operate="profileOperate($event, data)" />
    </template>
    <template #open="{ data }">
      <BrowserControl :data="data" :open-message="openMessage" @open="openBrowserBefore" />
    </template>
    <template #noteHeader="{ column: { title, _cache } }">
      <div class="flex items-center gap-2 note-header">
        <span>{{ title }}</span>
        <RxSvgIcon class="cursor-pointer color-[#989CA0]" :name="_cache.extend ? 'base/rx_ic_hidden' : 'base/rx_ic_eye'" @click.stop="_cache.extend = !_cache.extend" />
      </div>
    </template>
    <template #note="{ data, column: { _cache } }">
      <div class="flex items-center gap-1" @click.stop="operationHandler({ name: 'addNotes' }, data)">
        <RxButton v-tooltip.top="{ value: data.windowRemark, showDelay: 0 }" :class="{ 'remark-light': data.windowRemark }" text severity="secondary" size="xxs"
          :icon="data.windowRemark ? 'base/rx_ic_doc_fill' : 'base/rx_ic_doc_add'" :label="data.windowRemark || !_cache.extend ? '' : $t('添加备注')"></RxButton>
        <span v-if="_cache.extend" class="w-100 ellipsis-1">{{ data.windowRemark }}</span>
      </div>
    </template>
    <template #project="{ data }">
      <ProjectIcon :label-ids="data.labelIds" :project-id="data.projectId" :project-name="data.projectName" @update="updateMeta($event, [data.id])" />
    </template>
    <template #tags="{ data }">
      <TagsIcon :labels="data.labelInfo" :project-id="data.projectId" @update="updateMeta($event, [data.id], 'single')" />
    </template>
    <template #actions="{ data }">
      <div class="flex items-center gap-2">
        <div v-tooltip.top="{ value: $t('收藏'), showDelay: 500 }"
          class="flex justify-center items-center rounded cursor-pointer w-7 h-7 transition-all duration-150 hover:bg-black hover:bg-opacity-5 quick-icon"
          @click.stop="operationHandler({ name: 'fav' }, data)">
          <RxSvgIcon :name="data.isOften ? 'base/rx_ic_bookmark_fill' : 'base/rx_ic_bookmark'" :class="{ 'color-[#FC9D12]': data.isOften }" />
        </div>
        <Actions :operation="operation" @quick-click="operationHandler($event, data)" @more="showOperationMenu($event, data)" />
      </div>
    </template>
  </RyTable>
  <TagsIcon ref="tagsIcon" :labels="[]" :showCreateTag="false" @update="updateMeta($event, tableRef?.selectionData?.map((n: any) => n.id))" />
  <RxDrawer v-model:visible="drawer.visible" :dismissable="drawer.dismissable" :title="drawer.title">
    <template #default="{ closeCallback }">
      <EditCookies v-if="drawer.type === 'editCookies'" :data="drawer.data!" :workspace-name="workspaceName" @confirm="drawer.confirm(drawer.type, $event)" />
      <DrawersTtems v-else :type="drawer.type" :data="drawer.data" :title="drawer.title" @close="closeCallback" @confirm="drawer.confirm(drawer.type, $event)" />
    </template>
  </RxDrawer>
</template>

<style lang="scss" scoped>
.note-header {
  color: #000;
  font-size: 12px;
  line-height: 16px;
  font-weight: 600;
}

.remark-light {
  :deep(svg) {
    color: var(--Colors-text-text-brand, #11A3FD) !important;
  }
}

.quick-icon {
  color: var(--Colors-icon-icon-secondary, #575D60);

  &:active:not(.disabled) {
    color: orange;
  }

  &.disabled {
    cursor: not-allowed;
  }
}

:deep(.window-table) {
  tr:not([data-p-selected=true]):hover .direct-info {
    background-color: var(--Colors-Background-bg-body-hover, #f0f3f5);
  }

  tr:not([data-p-selected=true]):hover .edit-window-name-icon {
    visibility: visible;
  }
}
</style>
