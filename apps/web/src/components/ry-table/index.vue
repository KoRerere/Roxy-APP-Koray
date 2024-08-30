<script setup lang="ts">
import { clear } from 'node:console'
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
  selectionMode: {
    type: String as PropType<'single' | 'multiple' | undefined>,
    default: undefined,
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
})

defineEmits(['update:columns'])

const _columns = computed<any[]>(() => props.columns.filter((item: any) => item._visible ?? true))
const _filters = ref(props.filters)

const tableAttrs = reactive({
  'paginator': true,
  'rows': 15,
  'rows-per-page-options': [5, 15, 30, 70],
  'scrollable': true,
  'scroll-height': 'flex',
  'context-menu': true,
  'show-gridlines': true,
  'resizable-columns': true,
  'column-resize-mode': 'expand',
  'scroll': { x: 500, y: 400 },
  'selection-mode': props.selectionMode,
  'paginator-template': 'PrevPageLink PageLinks NextPageLink',
  ...useAttrs(),
})

const params = reactive<any>({
  sort: {},
  filter: {},
  default: {
    page_index: 1,
    page_size: 15,
  },
})

const _dataList = ref([])

const menuRef = ref()
const contextMenuSelection = ref()
const selectionData = ref()

function onRowContextMenu(event: DataTableRowContextMenuEvent) {
  menuRef.value.show(event.originalEvent)
}

function contextMenuClick(item: any) {
  props.operationHandler(item, contextMenuSelection.value)
}

function batchOperation(item: any) {
  props.operationHandler(item, selectionData.value)
  _clearSelection()
}

function onChangeParams(key: string, data: any) {
  Object.assign(params[key], data)
  _request()
}

function _getParams(outerParams?: any) {
  return {
    ...params.sort,
    ...params.filter,
    ...params.default,
    ...props.tableParams,
    ...outerParams,
  }
}

async function _request(outerParams?: any) {
  const requestParams = _getParams(outerParams)
  _dataList.value = Array.isArray(props.dataList)
    ? props.dataList
    : await props.tableRequest(requestParams)
  _clearSelection()
}

function _clearSelection() {
  selectionData.value = []
}

onMounted(() => {
  _request()
})

defineExpose({
  refresh: _request,
  clearSelection: _clearSelection,
  getParams: (callback: (params: any, done: any) => void) => {
    callback?.(
      _getParams(),
      (list?: any) => {
        _dataList.value = list || props.dataList
      },
    )
  },
})
</script>

<template>
  <div class="position-relative h-full">
    <div class="flex items-center rxtable-header">
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
    <div class="rxtable-body">
      <DataTable v-model:selection="selectionData" v-model:contextMenuSelection="contextMenuSelection"
        :value="_dataList" v-bind="tableAttrs" @row-contextmenu="onRowContextMenu">
        <template v-for="(_, name) in $slots" #[name]="slotProps">
          <slot :name="name" v-bind="slotProps" />
        </template>
        <template #paginatorstart>
          <div class="flex items-center rxtable-body-jump">
            <div>Go to</div>
            <InputNumber placeholder="Page" />
            <div>|</div>
          </div>
        </template>
        <template #empty>
          <slot name="table-empty">
            <div class="text-center">
              暂无数据
            </div>
          </slot>
        </template>

        <Column v-if="selectionMode" :selection-mode="selectionMode" :data-key="dataKey" header-style="width: 3rem" />
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
        <a v-ripple v-bind="ctxProps.action" @click="contextMenuClick(item)">
          <span :class="item.icon" />
          <span>{{ item.label }}</span>
        </a>
      </template>
    </ContextMenu>
    <Transition>
      <selection-operation v-if="selectionMode === 'multiple' && selectionData?.length > 0"
        v-model:selection="selectionData" :total="_dataList.length" :operation="operation"
        @batch-operation="batchOperation">
        <template #multiple-operation>
          <slot name="multiple-operation" :selection="selectionData" :clear-selection="_clearSelection" />
        </template>
      </selection-operation>
    </Transition>
  </div>
</template>

<style lang="scss" scoped>
.rxtable {
  &-header {
    display: flex;
    padding: var(--spacing-xl, 12px) var(--spacing-4xl, 24px);
    justify-content: space-between;
    align-items: center;
    align-self: stretch;
    border-bottom: 0.5px solid var(--Colors-Border-border-container, #c7cdd1);
  }

  &-body {
    height: calc(100% - 60px);

    &-jump {
      display: flex;
      gap: var(--spacing-lg, 8px);
    }
  }
}

:deep(.p-paginator-content-start) {
  margin: auto;
  margin-right: 0;
}

:deep(.p-datatable-paginator-bottom) {
  border-style: none;
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
