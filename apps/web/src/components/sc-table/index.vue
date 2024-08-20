<script setup lang="ts">
import type { DataTableRowContextMenuEvent } from 'primevue/datatable'
import selectionOperation from './selection-operation.vue'
import tableFilter from './table-filter.vue'
import tableConfig from './table-config.vue'
import tableSort from './table-sort.vue'

const _props = defineProps({
  dataKey: {
    type: String,
    default: 'id',
  },
  dataList: {
    type: Array as PropType<any[]>,
    required: true,
    default: () => [],
  },
  columns: {
    type: Array as PropType<any[]>,
    required: true,
    default: () => [],
  },
  filters: {
    type: Array as PropType<any[]>,
    default: () => [],
  },
  showConfig: {
    type: Boolean,
    default: true,
  },
  sorts: {
    type: Array as PropType<any[]>,
    default: () => [],
  },
  operation: {
    type: Array as PropType<any[]>,
    default: () => [],
  },
  operationHandler: {
    type: Function as PropType<(event: any, data: any) => void>,
    default: () => () => { },
  },
  rowSelection: {
    type: Boolean,
    default: false,
  },
})

defineEmits(['update:columns'])

const _columns = computed<any[]>(() => _props.columns.filter((item: any) => !item._hide))
const _filters = ref(_props.filters)

function onSort(data: any) {
  console.log('🚀 ~ sort ~ data:', data)
}

function filterChange(_data: any) {
  console.log('🚀 ~ filterChange ~ _data:', _data)
}
// ======================================
const menuRef = ref()
const contextMenuSelection = ref()
const RowsSelectedData = ref([])

function onRowContextMenu(event: DataTableRowContextMenuEvent) {
  menuRef.value.show(event.originalEvent)
}

function menuClick(item: any) {
  _props.operationHandler(item, contextMenuSelection.value)
}

function batchOperation(item: any) {
  _props.operationHandler(item, RowsSelectedData.value)
}
</script>

<template>
  <div class="position-relative h-full">
    <div class="flex items-center table-header">
      <div class="flex flex-auto gap-2">
        <table-filter :filters="_filters" @change="filterChange" />
        <slot name="header-extra" />
      </div>
      <div class="flex gap-2">
        <table-config v-if="showConfig" :columns="columns"
          @update:columns="(columns) => $emit('update:columns', columns)" />
        <table-sort v-if="sorts?.length > 0" :sorts="sorts" @sort="onSort" />
      </div>
    </div>
    <div class="table-body">
      <DataTable v-bind="$attrs" v-model:selection="RowsSelectedData"
        v-model:contextMenuSelection="contextMenuSelection" :value="dataList" paginator :rows="15"
        :rows-per-page-options="[5, 15, 30, 50]" scrollable scroll-height="flex" context-menu
        @row-contextmenu="onRowContextMenu">
        <template #empty>
          <slot name="table-empty">
            <div class="text-center">
              暂无数据
            </div>
          </slot>
        </template>

        <Column v-if="rowSelection" selection-mode="multiple" :data-key="dataKey" header-style="width: 3rem" />
        <Column v-for="column in _columns" :key="column.key" :field="column.key" :header="column.title">
          <template #body="{ data }">
            <slot :name="column.slot" :data="data">
              <span :class="column.classes">{{ column.getText?.(data) || data[column.key] }} </span>
            </slot>
          </template>
        </Column>
      </DataTable>
    </div>

    <ContextMenu ref="menuRef" :model="operation">
      <template #item="{ item, props }">
        <a v-ripple v-bind="props.action" @click="menuClick(item)">
          <span>{{ item.name }}</span>
        </a>
      </template>
    </ContextMenu>
    <Transition>
      <selection-operation v-if="RowsSelectedData?.length > 0" v-model:selection="RowsSelectedData"
        :total="dataList.length" :operation="operation" @batch-operation="batchOperation" />
    </Transition>
  </div>
</template>

<style lang="scss" scoped>
.table {
  &-header {
    height: 60px;
    background-color: olivedrab;
    flex-shrink: 0;
  }

  &-body {
    height: calc(100% - 60px);
  }
}

.v-enter-active,
.v-leave-active {
  transition: all 0.1s ease-in;
}

.v-enter-from,
.v-leave-to {
  opacity: 0;
}
</style>
