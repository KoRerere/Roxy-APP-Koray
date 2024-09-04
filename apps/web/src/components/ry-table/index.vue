<script setup lang="ts">
import type { DataTableRowContextMenuEvent } from 'primevue/datatable'
import type { PageState } from 'primevue/paginator'
import selectionOperation from './selection-operation.vue'
import tableFilter from './table-filter.vue'
import tableConfig from './table-config.vue'
import tableSort from './table-sort.vue'

defineOptions({
  inheritAttrs: false,
})

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

const _dataList = ref([])
const menuRef = ref()
const contextMenuSelection = ref()
const selectionData = ref()

const params = reactive<any>({
  sort: {},
  filters: {},
})

const paginatorConfig = reactive({
  page: 1,
  rows: 15,
  totalRecords: 0,
  rowsPerPageOptions: [5, 15, 30, 50],
  onResetPage(page: number = 1, rows: number = 15) {
    paginatorConfig.page = page
    paginatorConfig.rows = rows
  },
  onPage(event: PageState) {
    paginatorConfig.page = event.page + 1
    _request()
  },
  onRowsChange() {
    _request()
  },
})

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
  paginatorConfig.onResetPage()
  _request()
}

function _getParams(outerParams?: any) {
  return {
    page_index: paginatorConfig.page,
    page_size: paginatorConfig.rows,
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
    : await tableRequest(requestParams)
  _clearSelection()
}

async function tableRequest(requestParams: any) {
  const { data } = await props.tableRequest(requestParams)
  paginatorConfig.totalRecords = data?.total ?? 0
  return data?.rows || []
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
  <div class="position-relative h-full rxtable">
    <div class="flex items-center rxtable-header">
      <div class="flex flex-auto gap-2">
        <table-filter :filters="_filters" @change="(data) => onChangeParams('filters', data)" />
        <slot name="header-extra" />
      </div>
      <div class="flex gap-2">
        <table-config v-if="showConfig" :columns="columns"
          @update:columns="(columns) => $emit('update:columns', columns)">
          <template #footer>
            <slot name="config-footer" />
          </template>
        </table-config>

        <table-sort v-if="sorts?.length > 0" :sorts="sorts" @sort="(data) => onChangeParams('sort', data)" />
      </div>
    </div>
    <div class="rxtable-body">
      <DataTable v-model:selection="selectionData" v-model:contextMenuSelection="contextMenuSelection"
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
    <div class="rxtable-paginator">
      <Paginator template="PrevPageLink PageLinks NextPageLink" :rows="paginatorConfig.rows"
        :total-records="paginatorConfig.totalRecords" @page="paginatorConfig.onPage">
        <template #start>
          <div class="flex flex-1 items-center rxtable-paginator-jump">
            <div>Showing 11-20 of 300 profiles, </div>
            <Select v-model="paginatorConfig.rows" :options="paginatorConfig.rowsPerPageOptions"
              @change="paginatorConfig.onRowsChange" />
            <div>profiles/page</div>
            <div>Go to</div>
            <InputNumber class="rxtable-paginator-jump-input" />
            <div>|</div>
          </div>
        </template>
      </Paginator>
    </div>
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
      <template #custom-operation>
        <slot name="multiple-operation" :selection="selectionData" :clear-selection="_clearSelection" />
      </template>
    </selection-operation>
  </Transition>
</template>

<style lang="scss" scoped>
.rxtable {
  display: flex;
  flex-direction: column;

  &-header {
    display: flex;
    padding: var(--spacing-xl, 12px) var(--spacing-4xl, 24px);
    justify-content: space-between;
    align-items: center;
    align-self: stretch;
    border-bottom: 0.5px solid var(--Colors-Border-border-container, #c7cdd1);
  }

  &-body {
    flex: 1;
    overflow: hidden;
  }

  &-paginator {
    &-jump {
      display: flex;
      gap: var(--spacing-lg, 8px);

      &-input {
        :deep(.p-inputnumber-input) {
          width: 60px;
        }
      }
    }
  }
}

:deep(.p-paginator-content-start) {
  flex: 1;
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
