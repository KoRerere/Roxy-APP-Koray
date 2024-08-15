<script setup lang="ts">
import ScTable from '/@/components/sc-table'
import ScMenu from '/@/components/sc-menu'
import operatMenu from './components/operat-menu.vue'
import profileInfo from './components/profile-info.vue'
import filterTag from './components/filter-tag.vue'
import openBrowser from './components/open-browser.vue'
import selectProxy from './components/select-proxy.vue'

import useColumns from '/@/hooks/useColumns'
import columnsRow from './columns'
import { operation, operationHandler, sorts } from './operation'

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

const scMenu: any = ScMenu()

function customRow(data: any, _index: number) {
  return {
    onContextmenu: (mouseEvent: MouseEvent) => {
      mouseEvent.preventDefault()
      const { clientX, clientY } = mouseEvent
      scMenu.insert({
        operation,
        operationHandler: (event: any) => operationHandler(event, data),
        position: { x: clientX, y: clientY },
      })
    },
  }
}

function handleResizeColumn(w: any, col: any) {
  col.width = w
}

const visibleRight = ref(false)
</script>

<template>
  <div class="position-relative">
    <ScTable v-model:columns="columns" row-selection data-key="id" :data-list="dataList" :custom-row="customRow"
             :scroll="{ x: 500, y: 400 }" :operation="operation" :sorts="sorts" @resize-column="handleResizeColumn"
    >
      <template #table-header>
        <filter-tag>
          <template #tags>
            <div>Add filter</div>
          </template>
        </filter-tag>
      </template>
      <template #profile>
        <profile-info />
      </template>
      <template #open>
        <open-browser />
      </template>
      <template #operation="{ data }">
        <operat-menu :data="data" :operation="operation" :operation-handler="operationHandler" />
      </template>
    </ScTable>

    <Drawer v-model:visible="visibleRight" position="right" class="!w-[60%]">
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
