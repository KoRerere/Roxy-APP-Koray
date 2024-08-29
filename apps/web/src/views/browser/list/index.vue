<!-- eslint-disable ts/ban-ts-comment -->
<script setup lang="ts">
// @ts-ignore
import actions from '/@/components/actions.vue'
import ryTable from '/@/components/ry-table'
import ryTag from '/@/components/ry-tag'

import scvritems from '/@/views/browser/components/drawers/index.vue'
// @ts-ignore
import profileInfo from './components/profile-info.vue'
// @ts-ignore
import customFilter from './components/custom-filter.vue'
// @ts-ignore
import browserControl from './components/browser-control.vue'
// @ts-ignore
import multipleOperation from './components/multiple-operation.vue'

import useColumns from '/@/hooks/useColumns'
import { useContextMenu } from '/@/hooks/useContextMenu'

import columnsRow from './columns'
import { filters, operation, sorts } from './operation'
import { API } from '/@/api'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'

import type { DrawerType } from '../components/drawers/props'

const confirm = useConfirm()
const toast = useToast()

const route = useRoute()
const router = useRouter()

const [columns] = useColumns(columnsRow)
const [show] = useContextMenu()
const tableRef = ref()
const drawer = reactive({
  type: 'proxyList' as DrawerType,
  title: '',
  data: null,
  visible: false,
  confirm: (type: DrawerType, data: any) => {
    switch (type) {
      case 'proxyList':
        break
      case 'proxyForm':
        drawer.editProfile(data)
        break
      case 'accountForm':
        {
          const { id, dirId, windowPlatformList, ...item } = data
          console.log('🚀 ~ windowPlatformList:', windowPlatformList)
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
      tableRef.value.refresh()
    }
    catch (error) {
      toast.add({ severity: 'error', summary: '错误', detail: error, life: 5000 })
    }
    finally {
      drawer.visible = false
    }
  },
})

/**
 * ======================================
 */
async function tableRequest(params: any) {
  const { data } = await API.window.userGetWindowInfoV2List(params)
  // autoOpenBrowser(data.rows)
  return data.rows
}

// =========================================

async function operationHandler({ name }: any, data: any) {
  /**
   * 有批量操作
   */
  const _data = [].concat(data)
  switch (name) {
    case 'Test': {
      console.log('🚀 ~test:', data)
      break
    }
    case 'edit':
      localStorage.setItem('$editWindow', JSON.stringify(data))
      router.push({ name: 'browser-form', query: { id: data.id } })
      break
    case 'delete':
      deleteWindow(_data)
      break
  }
}

async function deleteWindow(data: any) {
  try {
    const ids = data.map((item: any) => item.id)
    await deletePopup()
    const { msg } = await API.window.userMdfWindowInfoBatchCreate({ ids, isDelete: true })
    toast.add({ severity: 'success', summary: '成功', detail: msg, life: 5000 })
    tableRef.value.refresh()
  }
  catch (error) {
    console.log('🚀 ~ deleteWindow ~ error:', error)
  }
}

function profileOperate(key: string, data: any) {
  const _data = toRaw(data)
  switch (key) {
    case 'addProxy':
      drawer.visible = true
      drawer.type = 'proxyForm'
      drawer.data = _data
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
    await deletePopup()
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

function _autoOpenBrowser(list: any) {
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
  window.electronAPI.send('browser:batchLaunch', [toRaw(data)])
}

function onMore([event, model]: any[]) {
  show(event, { model })
}

async function _testModify(data: any) {
  await API.window.userMdfWindowInfoSingleCreate(data)
}

function deletePopup() {
  return new Promise((resolve, reject) => {
    confirm.require({
      header: '警告',
      message: '您确定要删除此代理吗?',
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
      reject: () => reject(new Error('cancel popup')),
    })
  })
}
onMounted(() => {
})
</script>

<template>
  <ry-table ref="tableRef" v-model:columns="columns" :table-request="tableRequest" :operation="operation"
    selection-mode="multiple" :operation-handler="operationHandler" :filters="filters" :sorts="sorts" data-key="id"
    :show-gridlines="false">
    <template #header-extra>
      <custom-filter />
    </template>
    <template #profile="{ data }">
      <profile-info :data="data" @profile-operate="(key: string) => profileOperate(key, data)" />
    </template>
    <template #open="{ data }">
      <browser-control @open="() => openBrowser(data)" />
    </template>
    <template #group>
      <ryTag>123</ryTag>
    </template>
    <template #actions>
      <actions :operation="operation" @more="onMore" />
    </template>
    <template #multiple-operation="{ selection }">
      <multipleOperation :selection="selection" :operation="operation" @more="onMore" />
    </template>
  </ry-table>
  <Drawer v-model:visible="drawer.visible" position="right" class="browser-drawer-content !w-[auto]"
    :pt="{ mask: 'browser-drawer' }">
    <template #container="{ closeCallback }">
      <scvritems :type="drawer.type" :data="drawer.data" :title="drawer.title" @close="() => closeCallback()"
        @confirm="data => drawer.confirm(drawer.type, data)" />
    </template>
  </Drawer>
</template>

<style lang="scss">
.browser-drawer {
  padding: var(--spacing-xl, 12px);

  &-content {
    border-radius: var(--radius-lg, 8px);
    border: 0.5px solid var(--Colors-Border-border-strong, #a3a9ad);
    background: var(--Colors-Background-bg-body, #fff);
    box-shadow:
      0px 1px 1px 0px rgba(0, 0, 0, 0.04),
      0px 2px 8px 0px rgba(0, 0, 0, 0.04),
      0px 3px 17px 0px rgba(0, 0, 0, 0.04),
      0px 4px 30px 0px rgba(0, 0, 0, 0.12);
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

:deep(.custom-class) {
  color: red;
}
</style>
