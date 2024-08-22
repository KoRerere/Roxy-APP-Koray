<script setup lang="ts">
import type { DataTableRowContextMenuEvent } from 'primevue/datatable'
import selectionOperation from './selection-operation.vue'
import tableFilter from './table-filter.vue'
import tableConfig from './table-config.vue'
import tableSort from './table-sort.vue'

const props = defineProps({
  tableRequest: {
    type: Function as PropType<(data: any) => Promise<any>>,
    default: () => () => [],
  },
  tableParams: {
    type: Object as PropType<any>,
    default: () => ({}),
  },
  dataKey: {
    type: String,
    default: 'id',
  },
  dataList: {
    type: Array as PropType<any[]>,
    default: null,
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

const _columns = computed<any[]>(() => props.columns.filter((item: any) => item._visible ?? true))
const _filters = ref(props.filters)

const tableAttrs = reactive({
  'paginator': true,
  'rows': 15,
  'rows-per-page-options': [5, 15, 30, 50],
  'scrollable': true,
  'scroll-height': 'flex',
  'context-menu': true,
  'show-gridlines': true,
  'resizable-columns': true,
  'column-resize-mode': 'expand',
  'row-selection': true,
  'scroll': { x: 500, y: 400 },
  ...useAttrs(),
})

const params = reactive({
  filter: {},
  sort: {},
})

const _dataList = ref([])

function onChangeParams(key: string, data: any) {
  Object.assign(params[key], data)
  _request()
}

function _getParams(outerParams?: any) {
  return {
    ...params.filter,
    ...params.sort,
    ...props.tableParams,
    ...outerParams,
  }
}
async function _request(outerParams?: any) {
  const requestParams = _getParams(outerParams)
  _dataList.value = Array.isArray(props.dataList)
    ? props.dataList
    : await props.tableRequest(requestParams)
}

onMounted(() => {
  _request()
})

defineExpose({
  request: _request,
  getParams: (callback: (params: any, done) => void) => {
    callback?.(
      _getParams(),
      (list?: any[]) => {
        _dataList.value = list || props.dataList
      },
    )
  },
})

// ======================================
const menuRef = ref()
const contextMenuSelection = ref()
const RowsSelectedData = ref([])

function onRowContextMenu(event: DataTableRowContextMenuEvent) {
  menuRef.value.show(event.originalEvent)
}

function menuClick(item: any) {
  props.operationHandler(item, contextMenuSelection.value)
}

function batchOperation(item: any) {
  props.operationHandler(item, RowsSelectedData.value)
}
</script>

<template>
  <div class="position-relative h-full">
    <div class="flex items-center table-header">
      <div class="flex flex-auto gap-2">
        <table-filter :filters="_filters" @change="(data) => onChangeParams('filter', data)" />
        <slot name="header-extra" />
      </div>
      <div class="flex gap-2">
        <table-config v-if="showConfig" :columns="columns"
          @update:columns="(columns) => $emit('update:columns', columns)" />
        <table-sort v-if="sorts?.length > 0" :sorts="sorts" @sort="(data) => onChangeParams('sort', data)" />
      </div>
    </div>
    <div class="table-body">
      <DataTable v-model:selection="RowsSelectedData" v-model:contextMenuSelection="contextMenuSelection"
        :value="_dataList" v-bind="tableAttrs" @row-contextmenu="onRowContextMenu">
        <template v-for="(_, name) in $slots" #[name]="slotProps">
          <slot :name="name" v-bind="slotProps" />
        </template>
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
      <template #item="{ item, props: ctxProps }">
        <a v-ripple v-bind="ctxProps.action" @click="menuClick(item)">
          <span :class="item.icon" />
          <span>{{ item.name }}</span>
        </a>
      </template>
    </ContextMenu>
    <Transition>
      <selection-operation v-if="RowsSelectedData?.length > 0" v-model:selection="RowsSelectedData"
        :total="_dataList.length" :operation="operation" @batch-operation="batchOperation" />
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
