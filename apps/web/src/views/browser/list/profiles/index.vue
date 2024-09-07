<!-- eslint-disable ts/ban-ts-comment -->
<script setup lang="ts">
import actions from '/@/components/actions.vue'
import ryTable from '/@/components/ry-table'
import ryTag from '/@/components/ry-tag'
import remarkIcon from '/@/components/remark-icon'

import drawersitems from '/@/views/browser/components/drawers/index.vue'
import profileInfo from './components/profile-info.vue'
import customFilters from './components/custom-filters.vue'
import browserControl from './components/browser-control.vue'
import multipleOperation from './components/multiple-operation.vue'
import groupIcon from './components/group-icon.vue'
import tagsIcon from './components/tags-icon.vue'
import editCookies from './components/edit-cookies.vue'
import { getFormData } from '/@/utils/index'

import useColumns from '/@/hooks/useColumns'
import { useContextMenu } from '/@/components/rx-ctxmenu'

import columnsRow from './columns'
import { getCustomFilters, getFilters, getOperation, getSorts } from './operation'
import { API } from '/@/api'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import { useTemplateRef } from 'vue'

import type { DrawerType } from '/@/views/browser/components/drawers/props.ts'

type Type = DrawerType | 'editCookies'

const props = defineProps({
  currentFilter: {
    type: Object,
    default: undefined,
  },
})

const emit = defineEmits(['updateFilterTabs'])

const confirm = useConfirm()
const toast = useToast()

const route = useRoute()
const router = useRouter()

const [columns] = useColumns(columnsRow)
const [show] = useContextMenu()
const filters = ref(getFilters())
const ctmFilters = ref()
const sorts = ref(getSorts())
const operation = ref(getOperation())
const openMessage = reactive<any>({})

const remarkRef = useTemplateRef('remark')
const tableRef = useTemplateRef('windownTable')

const drawer = reactive({
  type: 'proxyList' as Type,
  title: '',
  data: null,
  visible: false,
  confirm: (type: Type, data: any) => {
    switch (type) {
      case 'proxyList':
        break
      case 'proxyForm':
        drawer.editProfile(data)
        break
      case 'accountForm':
        {
          const { id, dirId, windowPlatformList, ...item } = data
          drawer.editProfile({
            id,
            dirId,
            windowPlatformList: windowPlatformList.concat(item),
          })
          break
        }
    }
  },
  editProfile: async (data: any) => {
    try {
      const { msg } = await API.window.userMdfWindowInfoSingleCreate(data)
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

watch(() => props.currentFilter, (params) => {
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
  const filter_rule = columns.value.map(column => ({ name: column.key, sort: column._sort, status: column._visible ? 1 : 0 }))

  const { msg } = await API.window.userAddWindowFilterNameCreate({ ...formData, filter_condition, filter_rule })
  toast.add({ severity: 'success', summary: '成功', detail: msg, life: 5000 })
  emit('updateFilterTabs')
}

async function coverDefaultDisplay() {

  // warnPopup('此操作将会覆盖所有已保存的筛选条件的Display, 是否继续?')
  //   .then(() => { })
}

async function tableRequest(params: any) {
  const data = await API.window.userGetWindowInfoV2List(params)
  autoOpenBrowser(data.data.rows)
  return data
}

async function operationHandler(operate: any, data: any) {
  // console.log('🚀 ~ operationHandler ~ operate:', operate)
  /**
   * 兼容批量操作
   */
  const _data = [].concat(data)
  const ids: number[] = _data.map((item: any) => item.id)

  switch (operate.name) {
    case 'edit':
      localStorage.setItem(`$editWindow_${data.id}`, JSON.stringify(data))
      router.push({ name: 'browser-edit', query: { id: data.id } })
      break
    case 'close':
      window.electronAPI.send('browser:batchClose', _data.map((item: any) => item.dirId))
      break
    case 'fav':
      batchModifyWindow({ ids, isOften: true })
      break
    case 'addNotes':
      remarkRef.value?.onRemark()
      break
    case 'editCookies':
      drawer.visible = true
      drawer.type = 'editCookies'
      drawer.data = data
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

async function addRemark([windowRemark, close, datas]: [string, () => void, any]) {
  const ids = datas.map((item: any) => item.id)
  await batchModifyWindow({ ids, windowRemark })
  close()
}

/**
 * profile =================
 */
function profileOperate(key: string, data: any) {
  const _data = toRaw(data)
  switch (key) {
    case 'addProxy':
      drawer.visible = true
      drawer.type = 'proxyForm'
      drawer.title = `新建代理 [UID-${data.windowSortNum}]`
      break
    case 'editProxy':
      drawer.visible = true
      drawer.type = 'proxyForm'
      drawer.data = _data
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
    case 'refreshIp':
      refreshIp(_data)
      break
    case 'deleteProxy':
      deleteProxy(_data)
      break
    case 'addAccount':
      drawer.visible = true
      drawer.type = 'accountForm'
      drawer.data = _data
      drawer.title = `新建账号 [UID-${data.windowSortNum}]`
      break
    case 'selectAccount':
      break
  }
}

async function testProxy(data: any) {
  try {
    const res = await API.proxy.userCheckIpCreate({ id: data.moduleId })
    console.log('🚀 ~ testProxy ~ res:', res)

    toast.add({ severity: 'error', summary: '错误', detail: res.msg, life: 5000 })
  }
  catch (error) {

  }
}

async function refreshIp(_data: any) {
  toast.add({ severity: 'warn', summary: '警告', detail: '尽请期待', life: 5000 })
}

async function deleteProxy(data: any) {
  try {
    await warnPopup('您确定要删除此代理吗')
    drawer.editProfile({
      id: data.id,
      dirId: data.dirId,
      host: '',
      ipType: '',
      port: '',
      proxyCategory: 'noproxy',
      proxyPassword: '',
      proxyUserName: '',
      refreshUrl: '',
    })
  }
  catch (error) {
    console.log('🚀 ~ deleteProxy ~ error:', error)
  }
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
      // reject: () => reject(new Error('cancel popup')),
    })
  })
}
let canceOpenlListener
let canceCloselListener
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
  <ry-table ref="windownTable" v-model:columns="columns" :table-request="tableRequest" :operation="operation"
    selection-mode="multiple" :operation-handler="operationHandler" :filters="filters" :sorts="sorts" data-key="id"
    :show-gridlines="false">
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
    <template #group>
      <div class="flex gap-2">
        <ryTag>
          <groupIcon />
        </ryTag>
        <ryTag radius>
          <tagsIcon />
        </ryTag>
      </div>
    </template>
    <template #actions="{ data }">
      <div class="flex items-center">
        <span :class="{ 'text-orange': data.isOften }" class="mdi mdi-bookmark-music-outline mr-2 "
          @click.stop="operationHandler({ name: 'fav' }, data)" />
        <remarkIcon ref="remark" :value="data.windowRemark" :rows="[data]" @on-confirm="addRemark" />
        <actions :operation="operation" @quick-click="(operate) => operationHandler(operate, data)"
          @more="(event: Event) => showOperationMenu(event, data)" />
      </div>
    </template>
    <template #multiple-operation="{ selection, clearSelection }">
      <multipleOperation :selection="selection" :operation="operation" :clear-selection="clearSelection"
        @more="([event, cmpOperation]) => showOperationMenu(event, selection, { cmpOperation, clearSelection })"
        @open-browser="() => openBrowser(selection)" @quick-click="(e) => operationHandler(e, selection)" />
    </template>
  </ry-table>
  <Drawer v-model:visible="drawer.visible" position="right" :class="classes['browser-drawer-content']" class="!w-[auto]"
    :pt="{ mask: classes['browser-drawer'] }">
    <template #container="{ closeCallback }">
      <editCookies v-if="drawer.type === 'editCookies'" :data="drawer.data" />
      <drawersitems v-else :type="drawer.type" :data="drawer.data" :title="drawer.title" @close="() => closeCallback()"
        @confirm="data => drawer.confirm(drawer.type, data)" />
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
