<!-- eslint-disable ts/ban-ts-comment -->
<script setup lang="ts">
// @ts-ignore
import actions from '/@/components/actions.vue'
import ryTable from '/@/components/ry-table'
import ryTag from '/@/components/ry-tag'

import proxyList from '/@/views/browser/components/drawers/proxy-list.vue'
import proxyCreate from '/@/views/browser/components/drawers/proxy-create.vue'
import accountList from '/@/views/browser/components/drawers/account-list.vue'
import accountCreate from '/@/views/browser/components/drawers/account-create.vue'
// @ts-ignore
import profileInfo from './components/profile-info.vue'
// @ts-ignore
import customFilter from './components/custom-filter.vue'
// @ts-ignore
import browserControl from './components/browser-control.vue'
// @ts-ignore

import useColumns from '/@/hooks/useColumns'
import { useContextMenu } from '/@/hooks/useContextMenu'

import columnsRow from './columns'
import { filters, operation, operationHandler, sorts } from './operation'
import { API } from '/@/api'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'

const confirm = useConfirm()
const toast = useToast()

const route = useRoute()
const router = useRouter()

const [columns] = useColumns(columnsRow)
const [show] = useContextMenu()

const drawer = reactive({
  visible: false,
  type: 'proxyCreate',
  props: null,
})

// ======================================

async function tableRequest(params: any) {
  const { data } = await API.window.userGetWindowInfoV2List(params)
  // autoOpenBrowser(data.rows)
  return data.rows
}

function profileOperate(key: string, data: any) {
  switch (key) {
    case 'addProxy':
      drawer.visible = true
      drawer.type = 'proxyCreate'
      break
    case 'editProxy':
      drawer.visible = true
      drawer.type = 'proxyCreate'
      drawer.props = data
      break
    case 'selectProxy':
      drawer.visible = true
      drawer.type = 'proxyList'
      break
    case 'testProxy':
      testProxy(data)
      break
    case 'refreshIp':
      refreshIp(data)
      break
    case 'deleteProxy':
      deleteProxy(data)
      break
    case 'addAccount':
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

async function refreshIp(data) {
  toast.add({ severity: 'warn', summary: '警告', detail: '尽请期待', life: 5000 })
}

async function deleteProxy(data) {
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
    accept: async () => {
      try {
        const res = await API.proxy.userCheckIpCreate({ window_id: data.id, proxy_id: data.moduleId })
        toast.add({ severity: 'success', summary: '删除成功', detail: res.msg, life: 5000 })
      }
      catch (error) {
      }
    },
  })
}

function autoOpenBrowser(list: any) {
  const query = route.query.browser && JSON.parse(route.query.browser as string)
  if (query?.openBrowser) {
    const data = list.find(item => item.id === query.windowId)
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

onMounted(() => {
  // getPlatformInfo()
})
</script>

<template>
  <ry-table v-model:columns="columns" :table-request="tableRequest" :operation="operation" selection-mode="multiple"
    :operation-handler="operationHandler" :filters="filters" :sorts="sorts" data-key="id" :show-gridlines="false">
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
  </ry-table>
  <Drawer v-model:visible="drawer.visible" position="right" class="browser-drawer-content !w-[auto]"
    :pt="{ mask: 'browser-drawer' }">
    <template #container="{ closeCallback }">
      <proxyList v-if="drawer.type === 'proxyList'" @close="() => closeCallback()" @confirm="() => { }" />
      <proxyCreate v-if="drawer.type === 'proxyCreate'" @close="() => closeCallback()" @confirm="() => { }" />
      <accountList v-if="drawer.type === 'accountList'" :close-drawer="closeCallback" />
      <accountCreate v-if="drawer.type === 'accountCreate'" :close-drawer="closeCallback" @confirm="() => { }" />
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
