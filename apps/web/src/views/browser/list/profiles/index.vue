<!-- eslint-disable ts/ban-ts-comment -->
<script setup lang="ts">
import { useConfirm } from 'primevue/useconfirm'
import { useDialog } from 'primevue/usedialog'
import { useToast } from 'primevue/usetoast'
import { useTemplateRef } from 'vue'
import { API } from '/@/api'
import { useContextMenu } from '/@/components/rx-ctxmenu'
import { RxSvgIcon } from '/@/components/rx-icon/'
import ryTable from '/@/components/ry-table'
import popup from '/@/components/simplePopup'
import useColumns from '/@/hooks/useColumns'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { $t } from '/@/locales'
import { copyText, createDefaultObject, filterFieldByValue, getFormData } from '/@/utils'
import { useCheckProxy } from '/@/views/agent/hooks'
import { useTagsActions } from '/@/views/browser/list/tags/hook'
import columnsRow from './columns'
import browserControl from './components/browser-control.vue'
import customFilters from './components/custom-filters.vue'
import drawersitems from './components/drawers-item.vue'
import editCookies from './components/edit-cookies.vue'
import multipleOperation from './components/multiple-operation.vue'
import profileInfo from './components/profile-info.vue'
import projectIcon from './components/project-icon.vue'
import tagsIcon from './components/tags-icon.vue'
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
const toast = useToast()
const dialog = useDialog()
const [checkProxy] = useCheckProxy()
const [columns] = useColumns(columnsRow, props.isProjectProfile ? ['project'] : undefined)
const [showToast, onlyErrorToast] = useResponseToast()
const [addTag] = useTagsActions({ toast: false })

const [show] = useContextMenu()
const filtersMenu = ref()
const sorts = ref(getSorts())
const operation = ref(getOperation())
const openMessage = reactive<any>({})

const tableRef = useTemplateRef('windownTable')

const drawer = reactive({
  type: 'proxyList',
  title: '',
  data: null,
  visible: false,
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
    try {
      const { code, msg } = await API.window.userMdfWindowInfoSingleV2Create(data)
      showToast(code, msg, 5000)
      onRefreshTable()
    }
    catch (error) {
      onlyErrorToast(-1, error as string, 5000)
    }
    finally {
      drawer.visible = false
    }
  },
})

watch(() => props.currentFilter, (params: any) => {
  if (params && params.name !== 'recycle') {
    getCustomFilters(params.filter_condition || {})
      .then((data) => {
        filtersMenu.value = data
        onRefreshTable()
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

function onRefreshTable() {
  const params = filterFieldByValue(getFormData(filtersMenu.value))
  tableRef.value!.refresh(params)
}

async function saveFilters(formData: any) {
  if (!filtersMenu.value.some((item: any) => item.value)) {
    return
  }
  const { filter_name, filter_rule, sort } = formData
  const filter_condition = getFormData(filtersMenu.value)
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
  showToast(code, msg, 5000)
}

async function coverDefaultDisplay() {

  // warnPopup('此操作将会覆盖所有已保存的筛选条件的Display, 是否继续?')
  //   .then(() => { })
}

async function tableRequest(params: any) {
  // 0: 未删除
  const data = await API.window.userGetWindowInfoV2List({ projectIds: route.params.id, ...params, isDelete: 0 })
  autoOpenBrowser(data.data?.rows)
  return data
}

async function operationHandler(operate: any, data: any) {
  /**
   * 兼容批量操作
   */
  const datas = [].concat(data)
  const ids: number[] = datas.map((item: any) => item.id)

  switch (operate.name) {
    case 'edit':
      router.push({ name: 'browser-edit', query: { id: data.id } })
      break
    case 'copyId':
      copyText(data.dirId)
      showToast(0, $t('success'), 3000)
      break
    case 'close':
      window.electronAPI.send('browser:batchClose', datas.map((item: any) => item.dirId))
      break
    case 'addTag':
      addTag({
        confirmNext: ({ res }: any) => {
          updateMeta({ labelIds: [...data.labelIds, res.data.id] }, data)
        },
      })
      break
    case 'fav':
      drawer.updateProfile({ id: data.id, isOften: !data.isOften })
      break
    case 'addNotes':
      onRemark(datas)
      break
    case 'editCookies':
      drawer.visible = true
      drawer.data = data
      drawer.type = 'editCookies'
      break
    case 'delete':
      deleteBrowser(datas, ids)
      break
  }
}

function autoOpenBrowser(list: any) {
  const query = route.query.browser && JSON.parse(route.query.browser as string)
  if (query?.openBrowser) {
    const data = list.find((item: any) => item.id === query.windowId)
    router.replace({ name: route.name })
    if (data) {
      openBrowser(data)
    }
  }
}

function openBrowser(data: any) {
  const params = [].concat(data).map((item: any, index: number) => {
    openMessage[item.dirId] = {
      pending: true,
      data: {
        message: `${index === 0 ? $t('start') : $t('padding')}...`,
      },
    }
    return toRaw(item)
  })
  window.electronAPI.send('browser:batchLaunch', params)
}

function deleteBrowser(datas: any, ids: number[]) {
  if (datas.some((item: any) => Reflect.has(openMessage, item.dirId))) {
    toast.add({ severity: 'error', summary: $t('warn'), detail: $t('Please close the profile first'), life: 5000 })
  }
  else {
    warnPopup($t('Are you sure to perform this operation?'))
      .then(() => batchModifyWindow({ ids, isDelete: true }))
  }
}

function showOperationMenu(event: Event, data: any, extra?: any) {
  show(event, {
    operation: extra?.cmpOperation || operation.value,
    operationHandler: (operate: any) => {
      operationHandler(operate, data)
      extra?.clearSelection()
    },
  })
}

function onRemark(datas: any) {
  dialog.open(popup, {
    props: {
      showHeader: false,
      modal: true,
      blockScroll: true,
    },
    data: {
      props: {
        title: $t('Add notes to profile'),
        content: $t('Please add notes down below.'),
        inputs: [
          {
            type: 'text',
            name: 'windowRemark',
            value: datas[0].windowRemark,
          },
        ],
      },
      onConfirm: async (formData: any) => {
        const ids = datas.map((item: any) => item.id)
        await batchModifyWindow({ ids, windowRemark: formData.windowRemark })
      },
    },
  })
}

async function updateMeta(params: { labelIds?: number[], projectId?: number }, data: any) {
  await batchModifyWindow({ ...params, ids: [data.id] })
}

async function batchModifyWindow(params: any) {
  try {
    const { code, msg } = await API.window.userMdfWindowInfoBatchCreate(params)
    showToast(code, msg)
    if (code === 0) {
      onRefreshTable()
    }
  }
  catch (error) {
    onlyErrorToast(-1, error as string, 5000)
  }
}

/**
 * profile =================
 */
function profileOperate(key: string, data: any) {
  const _data = toRaw(data)
  drawer.data = _data
  switch (key) {
    case 'addProxy':
      drawer.visible = true
      drawer.type = 'proxyForm'
      drawer.title = $t('Add proxy for [UID-{uid}]', { uid: data.windowSortNum })
      break
    case 'editProxy':
      drawer.visible = true
      drawer.type = 'proxyForm'
      drawer.title = $t('Edit proxy for [UID-{uid}]', { uid: data.windowSortNum })
      break
    case 'selectProxy':
      drawer.visible = true
      drawer.type = 'proxyList'
      drawer.title = $t('Select proxy for [UID-{uid}]', { uid: data.windowSortNum })
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
      drawer.title = $t('Add accounts for [UID-{uid}]', { uid: data.windowSortNum })
      break
    case 'selectAccount':
      drawer.visible = true
      drawer.type = 'accountList'
      drawer.title = $t('Select accounts for [UID-{uid}]', { uid: data.windowSortNum })
      break
  }
}

async function testProxy(data: any) {
  const checkRes = await checkProxy(toRaw(data))

  if (data.moduleId) {
    await API.proxy.userMdfProxyModuleCreate([{ id: data.moduleId, ...checkRes }] as any)
  }

  drawer.updateProfile({ id: data.id, dirId: data.dirId, ...checkRes })
}

async function refreshUrl(data: any) {
  const isOK = await window.electronAPI.send('proxy:refreshUrl', data.refreshUrl)
  showToast(isOK ? 0 : -1, data.refreshUrl)
}

async function deleteProxy(data: any) {
  try {
    await warnPopup($t('Related profiles won\'t be infected.'))
    // 删除代理也是调用修改接口
    drawer.updateProfile({
      id: data.id,
      dirId: data.dirId,
      moduleId: 0, // 为0表示解除关联
      proxyCategory: 'noproxy',
      proxyMethod: 'custom',
      ...createDefaultObject(['host', 'ipType', 'port', 'proxyPassword', 'proxyUserName', 'refreshUrl'] as const, ''),
    })
  }
  catch (error) {
    onlyErrorToast(-1, error as string, 5000)
  }
}

function warnPopup(message: string) {
  return new Promise((resolve, _reject) => {
    confirm.require({
      header: $t('warn'),
      message,
      rejectProps: {
        label: $t('Cancel'),
        severity: 'secondary',
        outlined: true,
      },
      acceptProps: {
        label: $t('Confirm'),
        severity: 'danger',
      },
      accept: () => resolve(null),
    })
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
    .send('browser:getOpenedBrowser')
    .then((state) => {
      state.forEach((item: any) => {
        Reflect.set(openMessage, item.dirId, { data: item })
      })
    })

  getCustomFilters().then((data) => {
    filtersMenu.value ??= data
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
  <ry-table ref="windownTable" v-model:columns="columns" :table-filters="tableFilters" :sorts="sorts"
    :table-request="tableRequest" :operation="operation" :operation-handler="operationHandler" selection-mode="multiple"
    :show-actions="false">
    <template #header-extra>
      <customFilters :current-filter="currentFilter" :filters-menu="filtersMenu"
        :enabled-filter-save="!isProjectProfile" :save-filters="saveFilters" @filter-change="onRefreshTable" />
    </template>
    <template #config-footer>
      <div class="w-full text-right cursor-pointer" @click="coverDefaultDisplay">
        Save for default display
      </div>
    </template>
    <template #profile="{ data }">
      <profile-info :data="data" @profile-operate="profileOperate($event, data)" />
    </template>
    <template #open="{ data }">
      <browser-control :data="data" :open-message="openMessage" @open="openBrowser" />
    </template>
    <template #project="{ data }">
      <projectIcon :project-name="data.projectName" :project-id="data.projectId" @update="updateMeta($event, data)" />
    </template>
    <template #tags="{ data }">
      <tagsIcon :labels="data.labelInfo" @update="updateMeta($event, data)" />
    </template>
    <template #actions="{ data }">
      <div class="flex items-center">
        <RxSvgIcon v-tooltip.top="{ value: 'Mark as fav', showDelay: 500 }" name="base/rx_ic_bookmark"
          :class="{ 'text-orange': data.isOften }" class="cursor-pointer mr-2"
          @click.stop="operationHandler({ name: 'fav' }, data)" />
        <RxSvgIcon v-tooltip.top="{ value: data.windowRemark, showDelay: 500 }" name="base/rx_ic_doc_add"
          :class="{ 'text-orange': data.windowRemark }" class="cursor-pointer"
          @click.stop="operationHandler({ name: 'addNotes' }, data)" />
        <Actions :operation="operation" @quick-click="operationHandler($event, data)"
          @more="showOperationMenu($event, data)" />
      </div>
    </template>
    <template #multiple-operation="{ selection, clearSelection }">
      <multipleOperation :selection="selection" :operation="operation" :clear-selection="clearSelection"
        @more="([event, cmpOperation]) => showOperationMenu(event, selection, { cmpOperation, clearSelection })"
        @open-browser="openBrowser(selection)" @quick-click="operationHandler($event, selection)" />
    </template>
  </ry-table>
  <Drawer v-model:visible="drawer.visible" position="right" :class="classes['browser-drawer-content']" class="!w-[auto]"
    :pt="{ mask: classes['browser-drawer'] }">
    <template #container="{ closeCallback }">
      <editCookies v-if="drawer.type === 'editCookies'" :data="drawer.data!"
        @confirm="drawer.confirm(drawer.type, $event)" />
      <drawersitems v-else :type="drawer.type" :data="drawer.data" :title="drawer.title" @close="closeCallback"
        @confirm="drawer.confirm(drawer.type, $event)" />
    </template>
  </Drawer>
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
.table-filter {
  height: 54px;
  background-color: #fff;
  border-top: 0.5px solid var(--Color-neutrals-300, #c7cdd1);
  border-bottom: 0.5px solid var(--Color-neutrals-300, #c7cdd1);
}
</style>
