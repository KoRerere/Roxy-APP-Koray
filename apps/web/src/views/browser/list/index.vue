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

const dataList = [
  {
    name: 'John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown',
    age: 32,
    tags: [
      'nice',
      'developer',
    ],
    id: 0,
  },
  {
    name: '111',
    age: 42,
    tags: [
      'loser',
    ],
    id: 1,
  },
  {
    name: 'SCVR',
    age: 32,
    tags: [
      'cool',
      'teacher',
    ],
    id: 2,
  },
  {
    name: 'John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown',
    age: 32,
    tags: [
      'nice',
      'developer',
    ],
    id: 3,
  },
  {
    name: 'aaaaa',
    age: 42,
    tags: [
      'loser',
    ],
    id: 4,
  },
  {
    name: 'SCVR',
    age: 32,
    tags: [
      'cool',
      'teacher',
    ],
    id: 5,
  },
  {
    name: 'John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown',
    age: 32,
    tags: [
      'nice',
      'developer',
    ],
    id: 6,
  },
  {
    name: 'aaaaa',
    age: 42,
    tags: [
      'loser',
    ],
    id: 7,
  },
  {
    name: 'SCVR',
    age: 32,
    tags: [
      'cool',
      'teacher',
    ],
    id: 8,
  },
  {
    name: 'John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown',
    age: 32,
    tags: [
      'nice',
      'developer',
    ],
    id: 9,
  },
  {
    name: 'aaaaa',
    age: 42,
    tags: [
      'loser',
    ],
    id: 10,
  },
  {
    name: 'SCVR',
    age: 32,
    tags: [
      'cool',
      'teacher',
    ],
    id: 11,
  },
  {
    name: 'John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown John Brown',
    age: 32,
    tags: [
      'nice',
      'developer',
    ],
    id: 12,
  },
  {
    name: 'aaaaa',
    age: 42,
    tags: [
      'loser',
    ],
    id: 13,
  },
  {
    name: 'SCVR',
    age: 32,
    tags: [
      'cool',
      'teacher',
    ],
    id: 14,
  },
]

const [columns] = useColumns(columnsRow)

const menuRef = ref()
function handleMore(event: Event, _data: any) {
  // menuRef.value.hide()
  // nextTick(() => {
  menuRef.value.show(event)
  // })
}

const visibleRight = ref(true)
</script>

<template>
  <div @click="visibleRight = true">
    aaaaaaaa
  </div>
  <div class="position-relative">
    <ScTable v-model:columns="columns" show-gridlines resizable-columns column-resize-mode="expand" row-selection
      data-key="id" :data-list="dataList" :scroll="{ x: 500, y: 400 }" :operation="operation"
      :operation-handler="operationHandler" :filters="filters" :sorts="sorts">
      <template #header-extra>
        <custom-filter />
      </template>
      <template #profile>
        <profile-info />
      </template>
      <template #open>
        <open-browser />
      </template>
      <template #operation="{ data }">
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
      <template #container>
        <select-proxy />
      </template>
    </Drawer>
  </div>
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
