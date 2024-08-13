<script setup lang="ts">
import ScTable from '/@/components/sc-table'
import ScMenu from '/@/components/sc-menu'
import operatMenu from './components/operat-menu.vue'
import filterTag from './components/filter-tag.vue'
import profileInfo from './components/profile-info.vue'
import { DeleteOutlined, EditOutlined, PaperClipOutlined } from '@ant-design/icons-vue'

const columns = ref([
  {
    title: '宽度可拉伸 (200-500)',
    dataIndex: 'age',
    key: 'age',
    width: 200,
    minWidth: 200,
    maxWidth: 500,
    resizable: true,
  },
  {
    title: '插槽测试',
    dataIndex: 'name',
    key: 'name',
    width: 100,
    resizable: true,
    ellipsis: true,
    slot: 'name',
  },
  {
    title: '[getText && classes]',
    dataIndex: 'address',
    key: 'address',
    classes: 'custom-class',
    width: 100,
    resizable: true,
    ellipsis: true,
    getText: (data: any) => `${data.tags.join(' ')}`,
  },
  {
    title: '[getText && classes]',
    dataIndex: 'address',
    key: 'address',
    classes: 'custom-class',
    width: 100,
    resizable: true,
    ellipsis: true,
    getText: (data: any) => `${data.tags.join(' ')}`,
  },
  {
    title: '操作项',
    dataIndex: 'operation',
    key: 'operation',
    slot: 'operation',
  },
  {
    title: '[getText && classes]',
    dataIndex: 'address',
    key: 'address',
    classes: 'custom-class',
    width: 100,
    resizable: true,
    ellipsis: true,
    getText: (data: any) => `${data.tags.join(' ')}`,
  },
  {
    title: '[getText && classes]',
    dataIndex: 'address',
    key: 'address',
    classes: 'custom-class',
    width: 100,
    resizable: true,
    ellipsis: true,
    getText: (data: any) => `${data.tags.join(' ')}`,
  },
])

const dataSource = [
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
    name: '拉鸡巴倒',
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
    name: '拉鸡巴倒',
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
    name: '拉鸡巴倒',
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
    name: '拉鸡巴倒',
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
    name: '拉鸡巴倒',
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

const operation = [
  {
    key: 'test',
    name: '测试',
    icon: h(PaperClipOutlined),
    quick: true,
  },
  {
    key: 'Edit',
    name: '编辑',
    icon: h(EditOutlined),
  },
  {
    key: 'Delete',
    name: '删除',
    icon: h(DeleteOutlined),
  },
]

function operationHandler({ key }: any, data: any) {
  switch (key) {
    case 'test':
      console.log('🚀 ~test:', data)
      break
    case 'Edit':
      console.log('🚀 ~Edit:', data)
      break
    case 'Delete':
      console.log('🚀 ~Delete:', data)
      break
  }
}

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
</script>

<template>
  <div class="position-relative">
    <div class="flex items-center justify-center table-filter">
      <filter-tag>
        <template #tags>
          <div>
            <PaperClipOutlined /> Add filter
          </div>
        </template>
      </filter-tag>
    </div>
  </div>
  <ScTable row-key="id" :columns="columns" :data-source="dataSource" :custom-row="customRow"
           :scroll="{ x: 500, y: 200 }" :operation="operation" @resize-column="handleResizeColumn"
  >
    <template #name="{ data }">
      <span style="color:orange">{{ data.name }}</span>
    </template>
    <template #operation="{ data }">
      <operat-menu :data="data" :operation="operation" :operation-handler="operationHandler" />
    </template>
  </ScTable>
  <div>
    <profile-info />
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
