<!-- eslint-disable ts/ban-ts-comment -->
<script setup lang="ts">
// @ts-ignore
import actions from '/@/components/actions.vue'
import ryTable from '/@/components/ry-table'
import operatMenu from './components/operat-menu.vue'
// @ts-ignore
import profileInfo from './components/profile-info.vue'
// @ts-ignore
import customFilter from './components/custom-filter.vue'
// @ts-ignore
import browserControl from './components/browser-control.vue'
// @ts-ignore
import drawersContent from '../components/drawers/index.vue'

import useColumns from '/@/hooks/useColumns'
import { useContextMenu } from '/@/hooks/useContextMenu'

import columnsRow from './columns'
import { filters, operation, operationHandler, sorts } from './operation'
import { API } from '/@/api'
import type { UserGetPlatformInfoListData, UserGetWindowInfoListData } from '@roxy/backend-api'

const [columns] = useColumns(columnsRow)
const [show] = useContextMenu()

const drawer = reactive({
  visible: false,
})

// ======================================
const platformInfo = ref<UserGetPlatformInfoListData['data']['platformUrl']>([])

async function getPlatformInfo() {
  const { data } = await API.window.userGetPlatformInfoList({})
  platformInfo.value = data.platformUrl
}

async function tableRequest(params: any) {
  const { data } = await API.window.userGetWindowInfoList(params)
  return data.rows
}

function openBrowser(data: any) {
  window.electronAPI.send('browser:batchLaunch', [toRaw(data)])
}

function onMore([event, model]: any[]) {
  show(event, { model })
}

onMounted(() => {
  getPlatformInfo()
})
</script>

<template>
  <Button label="open-drawers" @click="drawer.visible = true" />
  <ry-table v-model:columns="columns" :table-request="tableRequest" :operation="operation" column-selection
    :operation-handler="operationHandler" :filters="filters" :sorts="sorts" data-key="id">
    <template #header-extra>
      <custom-filter />
    </template>
    <template #profile="{ data }">
      <profile-info :data="data" :platform-info="platformInfo" />
    </template>
    <template #open="{ data }">
      <browser-control @open="() => openBrowser(data)" />
    </template>
    <template #group>
      123
    </template>
    <template #actions>
      <actions :operation="operation" @more="onMore" />
    </template>
  </ry-table>
  <Drawer v-model:visible="drawer.visible" position="right" class="browser-drawer-content !w-[auto]"
    :pt="{ mask: 'browser-drawer' }">
    <template #container="{ closeCallback }">
      <drawers-content :close-drawer="closeCallback" />
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
