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
import { copyText, createDefaultObject, filterFieldByValue, getFormData, isEmptyValue } from '/@/utils'
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
import { getCustomFilters, getOperation, getSorts, tableFilters } from './operation'

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

const emit = defineEmits(['updateFilterTabs'])

const route = useRoute()
const router = useRouter()
const confirm = useConfirm()
const dialog = useDialog()
const role = useRoleStore()
const userStore = useUserStore()
const workspaceStore = useWorkspaceStore()

const { getProjects } = useMateGroup()
const [checkProxy] = useCheckProxy()
const [showToast, onlyErrorToast] = useResponseToast()
const [addTag] = useTagsActions({ toast: false })
const [show] = useContextMenu()
const tableRef = useTemplateRef('windownTable')
const tagsIconRef = useTemplateRef('tagsIcon')
const [columns] = useColumns(getColumns(), props.isProjectProfile ? ['project'] : undefined)

const filtersMenu = ref()
const operation = ref(getOperation())
const openMessage = reactive<any>({})
const hasFiltered = ref(false)

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
  const rows = (data.data.rows || []).map(item => ({
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
  const datas = [].concat(data).map(item => toRaw(item))
  const ids: number[] = datas.map((item: any) => item.id)

  switch (operate.name) {
    case 'edit':
      const [{ page_index }] = tableRef.value?.getParams()
      const customFilterParams = filtersMenu.value.reduce((acc: any, cur: any) => {
        if (cur.value) {
          acc[cur.name] = toRaw(cur.value)
        }
        return acc
      }, {})
      router.push({
        name: 'browser-edit', query: {
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
    case 'moveToProject':
      await onMoveToProject(datas)
      break
    case 'open':
    case 'view':
      await openBrowserBefore(data)
      break
    case 'restart':
      window.electronAPI.send('browser:batchRelaunch', datas.map((item: any) => item.dirId))
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

function autoOpenBrowser(list: any) {
  const query = route.query.browser && JSON.parse(route.query.browser as string)
  if (query?.openBrowser) {
    const data = list.find((item: any) => item.id === query.windowId)
    router.replace({ name: route.name })
    if (data) {
      openBrowserBefore(data)
    }
  }
}

async function openBrowserBefore(data: any) {
  const datas = [].concat(data)
  const result = await checkProfileStatus(datas)
  /**
   *过滤自身打开的窗口
   */
  const list = result.filter(item => !item.statusInfo.some(info => info.openUserId === userStore.userInfo.id))
  if (!list.length) {
    onOpenBrowser(datas)
    return
  }

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
  })
}

async function checkProfileStatus(datas: any) {
  const ids = datas.map((item: any) => item.id)
  const { data } = await API.window.userGetWindowStatusInfoCreate({ ids })
  return data.filter(item => item.openStatus === ProfileOpenStatus.opened)
}

function onOpenBrowser(datas: any[]) {
  const dirIds = datas.toSorted((a, b) => a.windowSortNum - b.windowSortNum).map((item: any, index: number) => {
    openMessage[item.dirId] = {
      pending: true,
      data: {
        message: `${index === 0 ? $t('启动中...') : $t('等待中...')}`,
      },
    }
    return item.dirId
  })
  window.electronAPI.send('browser:batchLaunch', dirIds)
}

function showOperationMenu({ event, operation }: { event: Event, operation: any }, data: any) {
  show(event, {
    operation,
    operationHandler: async (operate: any) => {
      try {
        await operationHandler(operate, data)
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

async function onMoveToProject(datas: any) {
  const options = await getProjects()

  return new Promise((resolve, reject) => {
    const names = datas.slice(0, 10).map((item: any) => `${workspaceName.value}-${item.windowSortNum}`).join(', ')

    dialog.open(Popup, {
      props: {
        showHeader: false,
        modal: true,
        blockScroll: true,
      },
      data: {
        props: {
          title: $t('移动项目'),
          content: $t('将移动 {names} 到所选项目', { names: `[${names}${datas.length > 10 ? '...' : ''}]` }),
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
      },
      onConfirm: async () => {
        // if (result === ClearType.cloud) {
        //   await API.window.userClearWindowCacheCreate({ ids: [data.id] })
        //   await electronAPI.send('browser:clearCache', { clearType: ClearType.all, dirId: data.dirId })
        // }
        // else {
        //   await electronAPI.send('browser:clearCache', { clearType: result, dirId: data.dirId })
        // }
      },
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
    })
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

let canceOpenlListener: any
let canceCloselListener: any
onBeforeMount(() => {
  canceOpenlListener = listenOpenMessage()
  canceCloselListener = listenCloseMessage()

  window.electronAPI
    .send('browser:getOpenedBrowserMessage')
    .then((state) => {
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
  <!-- eslint-disable-next-line vue/no-unused-refs -->
  <RyTable ref="windownTable" v-model:columns="columns" cacheKey="browser-list" :immediate="false"
    :table-filters="tableFilters" :table-sort="getSorts" :table-request="tableRequest" :operation="operation"
    :operation-handler="operationHandler" selection-mode="multiple" :show-actions="false" class="window-table">
    <template #header-extra>
      <CustomFilters :current-filter="currentFilter" :filters-menu="filtersMenu"
        :enabled-filter-save="!isProjectProfile" :save-filters="saveFilters" @filter-change="onRefreshTable" />
    </template>
    <!-- <template #config-footer>
      <div class="w-full text-right cursor-pointer" @click.stop="coverDefaultDisplay">
        Save for default display
      </div>
    </template> -->
    <template #table-empty>
      <CustomEmpty v-if="hasFiltered" icon="rx_illustration_filter.svg" :title="$t('暂无查询结果')"
        :desc="$t('当前条件下没有匹配的结果，请尝试更换其他筛选条件。')" />
      <CustomEmpty v-else icon="rx_illustration_roxybrowser.png" :title="$t('暂无窗口')"
        :desc="$t('窗口是 RoxyBrowser 的核心功能，可以帮助您管理多个浏览器窗口，并为它们设置不同的项目、平台账号、代理等，以方便您更好地执行业务操作。')">
        <template #extra>
          <div class="flex items-center gap-3">
            <RxButton v-if="!role.isViewer" outlined severity="secondary" size="xs" icon="base/rx_ic_browser_add"
              :label="$t('创建窗口')"
              @click.stop="router.push({ name: 'browser-create', query: { projectId: route.params.id } })" />
            <!-- <RxButton text severity="secondary" size="xs" :label="$t('窗口文档')" /> -->
          </div>
        </template>
      </CustomEmpty>
    </template>

    <template #profile="{ data }">
      <ProfileInfo :workspace-name="workspaceName" :data="data" :open-message="openMessage"
        @profile-operate="profileOperate($event, data)" />
    </template>
    <template #open="{ data }">
      <BrowserControl :data="data" :open-message="openMessage" @open="openBrowserBefore" />
    </template>
    <template #note="{ data }">
      <RxSvgIcon v-tooltip.top="{ value: data.windowRemark, showDelay: 0 }"
        :name="data.windowRemark ? 'base/rx_ic_doc_fill' : 'base/rx_ic_doc_add'"
        :class="{ 'color-[#12A3FC]': data.windowRemark }" class="cursor-pointer"
        @click.stop="operationHandler({ name: 'addNotes' }, data)" />
    </template>
    <template #project="{ data }">
      <ProjectIcon :label-ids="data.labelIds" :project-id="data.projectId" :project-name="data.projectName"
        @update="updateMeta($event, [data.id])" />
    </template>
    <template #tags="{ data }">
      <TagsIcon :labels="data.labelInfo" :project-id="data.projectId"
        @update="updateMeta($event, [data.id], 'single')" />
    </template>
    <template #actions="{ data }">
      <div class="flex items-center">
        <RxSvgIcon v-tooltip.top="{ value: $t('收藏'), showDelay: 500 }"
          :name="data.isOften ? 'base/rx_ic_bookmark_fill' : 'base/rx_ic_bookmark'"
          :class="{ 'color-[#FC9D12]': data.isOften }" class="cursor-pointer mr-2"
          @click.stop="operationHandler({ name: 'fav' }, data)" />
        <Actions :operation="operation" @quick-click="operationHandler($event, data)"
          @more="showOperationMenu($event, data)" />
      </div>
    </template>
  </RyTable>
  <TagsIcon ref="tagsIcon" :labels="[]" :showCreateTag="false"
    @update="updateMeta($event, tableRef?.selectionData?.map(n => n.id))" />
  <RxDrawer v-model:visible="drawer.visible" :dismissable="drawer.dismissable" :title="drawer.title">
    <template #default="{ closeCallback }">
      <EditCookies v-if="drawer.type === 'editCookies'" :data="drawer.data!" :workspace-name="workspaceName"
        @confirm="drawer.confirm(drawer.type, $event)" />
      <DrawersTtems v-else :type="drawer.type" :data="drawer.data" :title="drawer.title" @close="closeCallback"
        @confirm="drawer.confirm(drawer.type, $event)" />
    </template>
  </RxDrawer>
</template>

<style lang="scss" module="classes">
.browser-drawer {
  padding: var(--spacing-xl, 12px);

  &-content {
    border-radius: var(--radius-lg, 8px);
    border: 0.5px solid var(--Colors-Border-border-strong, #a3a9ad) !important;
    background: var(--Colors-Background-bg-body, #fff) !important;
    box-shadow:
      0px 1px 1px 0px rgba(0, 0, 0, 0.04),
      0px 2px 8px 0px rgba(0, 0, 0, 0.04),
      0px 3px 17px 0px rgba(0, 0, 0, 0.04),
      0px 4px 30px 0px rgba(0, 0, 0, 0.12) !important;
  }
}
</style>

<style lang="scss" scoped>
:deep(.window-table) {
  tr:not([data-p-selected=true]):hover .direct-info {
    background-color: var(--Colors-Background-bg-body-hover, #f0f3f5);
  }

  tr:not([data-p-selected=true]):hover .edit-window-name-icon {
    visibility: visible;
  }
}


.table-filter {
  height: 54px;
  background-color: #fff;
  border-top: 0.5px solid var(--Color-neutrals-300, #c7cdd1);
  border-bottom: 0.5px solid var(--Color-neutrals-300, #c7cdd1);
}
</style>
