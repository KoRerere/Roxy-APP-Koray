<!-- eslint-disable ts/ban-ts-comment -->
<script setup lang="ts">
import { format } from 'date-fns'
import { useConfirm } from 'primevue/useconfirm'
import { useDialog } from 'primevue/usedialog'
import { useToast } from 'primevue/usetoast'

import { useTemplateRef } from 'vue'
import columnsRow from './columns'
import browserControl from './components/browser-control.vue'
import customFilters from './components/custom-filters.vue'
import drawersitems from './components/drawers-item.vue'
import editCookies from './components/edit-cookies.vue'
import multipleOperation from './components/multiple-operation.vue'
import profileInfo from './components/profile-info.vue'

import tagsIcon from './components/tags-icon.vue'
import { getCustomFilters, getFilters, getOperation, getSorts } from './operation'

import { API } from '/@/api'
import actions from '/@/components/actions.vue'
import { useContextMenu } from '/@/components/rx-ctxmenu'
import { RxSvgIcon } from '/@/components/rx-icon/'
import ryTable from '/@/components/ry-table'
import popup from '/@/components/simplePopup'
import { ProxyCheckStatus } from '/@/enums'
import useColumns from '/@/hooks/useColumns'
import { createDefaultObject, getFormData } from '/@/utils/index'

const props = defineProps({
  currentFilter: {
    type: Object,
    default: undefined,
  },
})

const emit = defineEmits(['updateFilterTabs'])

const confirm = useConfirm()
const toast = useToast()
const dialog = useDialog()

const route = useRoute()
const router = useRouter()

const [columns] = useColumns(columnsRow)
const [show] = useContextMenu()
const filters = ref(getFilters())
const ctmFilters = ref()
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
    const { id, dirId, windowPlatformList, platformIds } = drawer.data!
    switch (type) {
      case 'proxyForm': {
        drawer.updateProfile({ ...data, id, dirId, proxyMethod: 'custom' })
        break
      }
      case 'proxyList': {
        drawer.updateProfile({ id, dirId, moduleId: data.id, proxyMethod: 'choose' })
        break
      }
      case 'accountForm': {
        drawer.updateProfile({
          id,
          dirId,
          windowPlatformList: (windowPlatformList as any[]).concat(data),
        })
        break
      }
      case 'accountList': {
        const platformUrlIds = data.map((item: any) => item.id).filter(Boolean).concat(platformIds)
        drawer.updateProfile({ id, dirId, platformUrlIds })
        break
      }
    }
  },
  updateProfile: async (data: any) => {
    try {
      const { msg } = await modifyWindowInfo(data)
      toast.add({ severity: 'success', summary: '成功', detail: msg, life: 5000 })
      tableRef.value?.refresh()
    }
    catch (error) {
      toast.add({ severity: 'error', summary: '错误', detail: error, life: 5000 })
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
        ctmFilters.value = data
        filterChange()
      })
  }
}, {
  immediate: true,
})

function filterChange() {
  const params = getFormData(ctmFilters.value)
  tableRef.value!.refresh(params)
}

async function saveFilters(formData: { filter_name: string }) {
  if (!filters.value.length) {
    return
  }
  const filter_condition = getFormData(ctmFilters.value)
  const filter_rule = columns.value.map((column: any) => ({ name: column.key, sort: column._sort, status: column._visible ? 1 : 0 }))

  const { msg } = await API.window.userAddWindowFilterNameCreate({ ...formData, filter_condition, filter_rule })
  toast.add({ severity: 'success', summary: '成功', detail: msg, life: 5000 })
  emit('updateFilterTabs')
}

async function coverDefaultDisplay() {

  // warnPopup('此操作将会覆盖所有已保存的筛选条件的Display, 是否继续?')
  //   .then(() => { })
}

async function tableRequest(params: any) {
  // 0: 未删除
  const data = await API.window.userGetWindowInfoV2List({ ...params, isDelete: 0 })
  autoOpenBrowser(data.data.rows)
  return data
}

async function operationHandler(operate: any, data: any) {
  // console.log('🚀 ~ operationHandler ~ operate:', operate)
  /**
   * 兼容批量操作
   */
  const datas = [].concat(data)
  const ids: number[] = datas.map((item: any) => item.id)

  switch (operate.name) {
    case 'edit':
      localStorage.setItem(`$editWindow_${data.id}`, JSON.stringify(data))
      router.push({ name: 'browser-edit', query: { id: data.id } })
      break
    case 'close':
      window.electronAPI.send('browser:batchClose', datas.map((item: any) => item.dirId))
      break
    case 'fav':
      batchModifyWindow({ ids, isOften: !data.isOften })
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
      warnPopup('确定要删除所选窗口？')
        .then(() => batchModifyWindow({ ids, isDelete: true }))
      break
  }
}

async function batchModifyWindow(params: any) {
  try {
    const { msg } = await API.window.userMdfWindowInfoBatchCreate(params)
    toast.add({ severity: 'success', summary: '成功', detail: msg, life: 5000 })
    tableRef.value?.refresh()
  }
  catch (error) {
    console.log('🚀 ~ deleteWindow ~ error:', error)
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
        message: index === 0 ? '启动中...' : '正在排队...',
      },
    }
    return toRaw(item)
  })
  window.electronAPI.send('browser:batchLaunch', params)
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
        title: 'Install via Chrome Store',
        content: 'Please paste the chrome extension URL down below then click the install button.',
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

async function onEditCookies(cookie: any[]) {
  const params = Object.assign({}, drawer.data, { cookie })
  const { msg } = await modifyWindowInfo(params)
  toast.add({ severity: 'success', summary: '成功', detail: msg, life: 5000 })
  drawer.visible = false
  tableRef.value?.refresh()
}

function updateTags(labelIds: number[], data: any) {
  modifyWindowInfo({ id: data.id, labelIds })
}

function modifyWindowInfo(params: any) {
  return API.window.userMdfWindowInfoSingleCreate(params)
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
      drawer.title = `新建代理 [UID-${data.windowSortNum}]`
      break
    case 'editProxy':
      drawer.visible = true
      drawer.type = 'proxyForm'
      drawer.title = `编辑代理 [UID-${data.windowSortNum}]`
      break
    case 'selectProxy':
      drawer.visible = true
      drawer.type = 'proxyList'
      drawer.title = `选择代理 [UID-${data.windowSortNum}]`
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
      drawer.title = `新建账号 [UID-${data.windowSortNum}]`
      break
    case 'selectAccount':
      drawer.visible = true
      drawer.type = 'accountList'
      drawer.title = `选择账号 [UID-${data.windowSortNum}]`
      break
  }
}

async function testProxy(data: any) {
  const checkRes = await window.electronAPI.send('proxy:detection', toRaw(data) as any)
  const params = {
    checkStatus: !checkRes.ip ? ProxyCheckStatus.failure : ProxyCheckStatus.success,
    lastCity: checkRes.city ?? '',
    lastCountry: checkRes.country_code ?? '',
    lastIp: checkRes.ip ?? '',
    checkTime: format(new Date(), 'yyyy-MM-dd HH:mm:ss'),
  }

  if (data.moduleId) {
    await API.proxy.userMdfProxyModuleCreate([{ id: data.moduleId, ...params }] as any)
  }

  drawer.updateProfile({ id: data.id, dirId: data.dirId, ...params })
}

async function refreshUrl(data: any) {
  const isOK = await window.electronAPI.send('proxy:refreshUrl', data.refreshUrl)
  toast.add({ severity: isOK ? 'success' : 'error', summary: isOK ? 'Success' : 'Failure', detail: data.refreshUrl, life: 5000 })
}

async function deleteProxy(data: any) {
  try {
    await warnPopup('您确定要删除此代理吗')
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
    toast.add({ severity: 'warn', summary: '警告', detail: error, life: 5000 })
  }
}

function warnPopup(message: string) {
  return new Promise((resolve, _reject) => {
    confirm.require({
      header: '警告',
      message,
      rejectProps: {
        label: '取消',
        severity: 'secondary',
        outlined: true,
      },
      acceptProps: {
        label: '确定',
        severity: 'danger',
      },
      accept: () => resolve(null),
    })
  })
}

function listenOpenMessage() {
  return window.electronAPI.on('browser:launch-process-message', (event) => {
    const id = event.data?.dirId || event.data
    openMessage[id as string] = event
  })
}

function listenCloseMessage() {
  return window.electronAPI.on('browser:on-close', (dirId) => {
    Reflect.deleteProperty(openMessage, dirId)
  })
}

let canceOpenlListener: any
let canceCloselListener: any
onMounted(() => {
  canceOpenlListener = listenOpenMessage()
  canceCloselListener = listenCloseMessage()
})

onBeforeUnmount(() => {
  canceOpenlListener?.()
  canceCloselListener?.()
})
</script>

<template>
  <!-- eslint-disable-next-line vue/no-unused-refs -->
  <ry-table ref="windownTable" v-model:columns="columns" :filters="filters" :sorts="sorts" :table-request="tableRequest"
    :operation="operation" :operation-handler="operationHandler" selection-mode="multiple">
    <template #header-extra>
      <customFilters :ctm-filters="ctmFilters" @filter-change="filterChange" @save-filters="saveFilters" />
    </template>
    <template #config-footer>
      <div class="flex-1 flex justify-end cursor-pointer config-footer" @click="coverDefaultDisplay">
        Save for all filters
      </div>
    </template>

    <template #profile="{ data }">
      <profile-info :data="data" @profile-operate="(key: string) => profileOperate(key, data)" />
    </template>
    <template #open="{ data }">
      <browser-control :data="data" :open-message="openMessage" @open="() => openBrowser(data)" />
    </template>
    <template #tags="{ data }">
      <tagsIcon :labels="data.labelInfo" @update="(labelIds: number[]) => updateTags(labelIds, data)" />
    </template>
    <template #actions="{ data }">
      <div class="flex items-center">
        <RxSvgIcon v-tooltip.top="{ value: 'Mark as fav', showDelay: 500 }" :size="16" name="base/rx_ic_bookmark"
          :class="{ 'text-orange': data.isOften }" class="mr-2" @click.stop="operationHandler({ name: 'fav' }, data)" />
        <RxSvgIcon v-tooltip.top="{ value: data.windowRemark, showDelay: 500 }" :size="16" name="base/rx_ic_doc_add"
          :class="{ 'text-orange': data.windowRemark }" @click.stop="operationHandler({ name: 'addNotes' }, data)" />
        <actions :operation="operation" @quick-click="(operate: any) => operationHandler(operate, data)"
          @more="(event: Event) => showOperationMenu(event, data)" />
      </div>
    </template>
    <template #multiple-operation="{ selection, clearSelection }">
      <multipleOperation :selection="selection" :operation="operation" :clear-selection="clearSelection"
        @more="([event, cmpOperation]) => showOperationMenu(event, selection, { cmpOperation, clearSelection })"
        @open-browser="() => openBrowser(selection)"
        @quick-click="(event: any) => operationHandler(event, selection)" />
    </template>
  </ry-table>
  <Drawer v-model:visible="drawer.visible" position="right" :class="classes['browser-drawer-content']" class="!w-[auto]"
    :pt="{ mask: classes['browser-drawer'] }">
    <template #container="{ closeCallback }">
      <editCookies v-if="drawer.type === 'editCookies'" :data="drawer.data!" @confirm="onEditCookies" />
      <drawersitems v-else :type="drawer.type" :data="drawer.data" :title="drawer.title" @close="closeCallback"
        @confirm="(data: any) => drawer.confirm(drawer.type, data)" />
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

.config-footer {
  padding: var(--spacing-lg, 8px) 10px;
  gap: var(--spacing-lg, 8px);
  border-top: 0.5px solid var(--Colors-Border-border-container, #c7cdd1);

  // padding: var(--spacing-sm, 4px) var(--spacing-md, 6px);
}
</style>
