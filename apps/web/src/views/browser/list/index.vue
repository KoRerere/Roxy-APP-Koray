<script setup lang="ts">
import ScTable from '/@/components/sc-table'
import operatMenu from './components/operat-menu.vue'
import profileInfo from './components/profile-info.vue'
import customFilter from './components/custom-filter.vue'
import openBrowser from './components/open-browser.vue'
import selectProxy from './components/select-proxy.vue'

import useColumns from '/@/hooks/useColumns'
import columnsRow from './columns'
import { filters, operation, operationHandler, sorts } from './operation'
import { API } from '/@/api'
import type { UserGetPlatformInfoListData, UserGetWindowInfoListData } from '@roxy/backend-api'

const [columns] = useColumns(columnsRow)

const menuRef = ref()
function handleMore(event: Event, _data: any) {
  // menuRef.value.hide()
  // nextTick(() => {
  menuRef.value.show(event)
  // })
}

const visibleRight = ref(false)
// ======================================
const platformInfo = ref<UserGetPlatformInfoListData['data']['platformUrl']>([])
const dataList = ref<UserGetWindowInfoListData['data']['rows']>([])

async function getPlatformInfo() {
  const { data } = await API.window.userGetPlatformInfoList({})
  platformInfo.value = data.platformUrl
}

async function getwindowList() {
  const { data } = await API.window.userGetWindowInfoList({})
  dataList.value = data.rows
}

onMounted(() => {
  // getPlatformInfo()
  getwindowList()
})
</script>

<template>
  <div @click="visibleRight = true">
    aaaaaaaa
  </div>
  <ScTable v-model:columns="columns" show-gridlines resizable-columns column-resize-mode="expand" row-selection
    data-key="id" :data-list="dataList" :scroll="{ x: 500, y: 400 }" :operation="operation"
    :operation-handler="operationHandler" :filters="filters" :sorts="sorts">
    <template #header-extra>
      <custom-filter />
    </template>
    <template #profile="{ data }">
      <profile-info :data="data" :platform-info="platformInfo" />
    </template>
    <template #open>
      <open-browser />
    </template>
    <template #group>
      123
    </template>
    <template #actions="{ data }">
      <operat-menu :data="data" :operation="operation" @more="(event) => handleMore(event, data)" />
    </template>
  </ScTable>
  <TieredMenu ref="menuRef" :model="operation" popup>
    <template #item="{ item, props }">
      <a v-ripple v-bind="props.action">
        <span :class="item.icon" />
        <span>{{ item.name }}</span>
      </a>
    </template>
  </TieredMenu>
  <Drawer v-model:visible="visibleRight" position="right" class="!w-[80%]">
    <template #container="{ closeCallback }">
      <select-proxy :close-drawer="closeCallback" />
    </template>
  </Drawer>
</template>

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
