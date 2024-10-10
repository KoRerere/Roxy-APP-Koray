<script setup lang="ts">
import type { DataTableRowContextMenuEvent } from 'primevue/datatable'
import type { PageState } from 'primevue/paginator'
import { useContextMenu } from '/@/components/rx-ctxmenu'
import { $t } from '/@/locales'
import { isEmptyValue, isFunction } from '/@/utils'
import SelectionOperation from './selection-operation.vue'
import TableDisplay from './table-display.vue'
import TableFilter from './table-filter.vue'
import TableSort from './table-sort.vue'

defineOptions({
  inheritAttrs: false,
})

const props = defineProps({
  dataKey: {
    type: String,
    default: 'id',
  },
  dataList: {
    type: Array as PropType<any[]>,
    default: null,
  },
  tableParams: {
    type: Object as PropType<any>,
    default: () => ({}),
  },
  tableRequest: {
    type: Function as PropType<(data: any) => Promise<any>>,
    default: () => () => Promise.resolve({}),
  },
  columns: {
    type: Array as PropType<any[]>,
    required: true,
    default: () => [],
  },
  tableFilters: {
    type: Function as PropType<() => any>,
    default: () => [],
  },
  sorts: {
    type: Array as PropType<any[]>,
    default: () => [],
  },
  operation: {
    type: Array as PropType<any[]>,
    default: () => [],
  },
  tableOperation: {
    type: Function as PropType<(data: any) => any[]>,
    default: () => [],
  },
  operationHandler: {
    type: Function as PropType<(event: any, data: any) => void>,
    default: () => () => { },
  },
  multipleOperation: {
    type: Boolean,
    default: true,
  },
  paginator: {
    type: Boolean,
    default: true,
  },
  showTableHeader: {
    type: Boolean,
    default: true,
  },
  showDisplay: {
    type: Boolean,
    default: true,
  },
  showActions: {
    type: Boolean,
    default: true,
  },
  showActionsMenu: {
    type: Boolean,
    default: true,
  },
  selectionMode: {
    type: String as PropType<'single' | 'multiple' | undefined>,
    default: undefined,
  },
})

defineEmits(['update:columns'])

const [show] = useContextMenu()

const _columns = computed(() => props.columns.filter((item: any) => item._visible ?? true))
const _filters = ref()
const _dataList = ref()
const tableList = computed(() => Array.isArray(props.dataList) ? props.dataList : _dataList.value)

const { selection: outerSelection, 'onUpdate:selection': onUpdateSelection, ...attrs } = toRefs(reactive(useAttrs()))

const tableAttrs = reactive({
  'data-key': props.dataKey,
  'scrollable': true,
  'scroll-height': 'flex',
  'context-menu': true,
  'show-gridlines': false,
  'resizable-columns': true,
  'column-resize-mode': 'expand',
  'scroll': { x: 500, y: 400 },
  ...attrs,
})

const hasOuterSelection = isFunction(onUpdateSelection?.value)
const innerSelection = ref()

const selectionData = computed({
  get() {
    return hasOuterSelection ? outerSelection.value : innerSelection.value
  },
  set(value: any) {
    if (hasOuterSelection) {
      (onUpdateSelection?.value as any)(value)
    }
    else {
      innerSelection.value = value
    }
  },
})

const params = reactive<any>({
  sort: {},
  filters: {},
  default: {},
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
    if (paginatorConfig.rows >= paginatorConfig.totalRecords) {
      paginatorConfig.page = 1
    }
    _request()
  },
})

const paginatorInfo = computed(() => $t('table.paginator', {
  start: (paginatorConfig.page - 1) * paginatorConfig.rows + 1,
  end: Math.min(paginatorConfig.page * paginatorConfig.rows, paginatorConfig.totalRecords),
  total: paginatorConfig.totalRecords,
}))

function batchOperation(item: any) {
  props.operationHandler(item, selectionData.value)
  _clearSelection()
}

function onChangeParams(key: string, data: any) {
  Object.assign(params[key], data)
  paginatorConfig.onResetPage()
  _request()
}

async function _getFilters() {
  _filters.value = await props.tableFilters()
}

function _getParams(outerParams?: any) {
  return {
    page_index: paginatorConfig.page,
    page_size: paginatorConfig.rows,
    ...params.sort,
    ...params.filters,
    ...params.default,
    ...props.tableParams,
    ...outerParams,
  }
}

async function _request(outerParams?: any) {
  const requestParams = _getParams(outerParams)
  const { data } = await props.tableRequest(requestParams)
  paginatorConfig.totalRecords = data?.total ?? 0
  _dataList.value = data?.rows || []
  _clearSelection()
}

function _getOperation(data: any) {
  return (!isEmptyValue(props.operation) ? props.operation : props.tableOperation(data)).filter((item: any) => item.power !== false)
}

function _clearSelection() {
  if (!hasOuterSelection) {
    selectionData.value = undefined
  }
}

function onRowContextMenu(event: DataTableRowContextMenuEvent) {
  if (!tableAttrs['context-menu']) {
    return
  }
  show(event.originalEvent, {
    operation: _getOperation(event.data),
    operationHandler: (operate: any) => props.operationHandler(operate, event.data),
  })
}

function showOperationMenu(event: Event, data: any) {
  show(event, {
    operation: _getOperation(data),
    operationHandler: (operate: any) => props.operationHandler(operate, data),
  })
}

onMounted(() => {
  _getFilters()
  _request()
})

defineExpose({
  refresh: _request,
  clearSelection: _clearSelection,
  getParams: () => [_getParams(), (list: any) => { _dataList.value = list || [] }],
})
</script>

<template>
  <div class="position-relative w-full h-full rxtable">
    <div v-if="showTableHeader" class="flex items-center rxtable-header">
      <div class="flex flex-auto gap-2">
        <TableFilter :filters="_filters" @change="onChangeParams('filters', $event)" />
        <slot name="header-extra" />
      </div>
      <div class="flex gap-2">
        <TableDisplay v-if="showDisplay" :columns="columns" @update:columns="$emit('update:columns', $event)">
          <template #footer>
            <slot name="config-footer" />
          </template>
        </TableDisplay>
        <TableSort v-if="sorts.length > 0" :sorts="sorts" @sort="onChangeParams('sort', $event)" />
      </div>
    </div>
    <div class="rxtable-body">
      <DataTable v-model:selection="selectionData" :value="tableList" v-bind="tableAttrs"
        @row-contextmenu="onRowContextMenu">
        <template v-for="(_, name) in $slots" #[name]="slotProps">
          <slot :name="name" v-bind="slotProps" />
        </template>
        <template #empty>
          <slot name="table-empty">
            <div class="text-center">
              {{ $t('table.noData') }}
            </div>
          </slot>
        </template>
        <Column v-if="selectionMode" :selection-mode="selectionMode" header-style="width: 3rem" />
        <Column v-for="column in _columns" :key="column.key" :field="column.key" :header="$t(column.title)"
          :header-style="column.style" :frozen="!!column.alignFrozen" :align-frozen="column.alignFrozen">
          <template #body="{ data }">
            <slot :name="column.slot" :data="data">
              <div :style="{ width: `${column.width}px` || 'auto' }" class="rxtable-cell" :class="column.classes"
                :title="column.getText?.(data) || data[column.key]">
                {{ column.getText?.(data) || data[column.key] }}
              </div>
            </slot>
          </template>
        </Column>
        <Column v-if="showActions" field="actions" header="Actions" align-frozen="right" frozen
          header-style="width: 9rem">
          <template #body="{ data }">
            <div class="flex items-center">
              <slot name="actions-extra" :data="data" />
              <slot name="actions" :data="data">
                <actions :show-menu="showActionsMenu" :operation="_getOperation(data)"
                  @quick-click="operationHandler($event, data)" @more="showOperationMenu($event, data)" />
              </slot>
            </div>
          </template>
        </Column>
      </DataTable>
    </div>
    <div v-if="paginator" class="rxtable-paginator">
      <Paginator template="PrevPageLink PageLinks NextPageLink" :rows="paginatorConfig.rows"
        :total-records="paginatorConfig.totalRecords" @page="paginatorConfig.onPage">
        <template #start>
          <div class="flex flex-1 items-center rxtable-paginator-jump">
            <div>{{ paginatorInfo }}</div>
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
  <Transition>
    <SelectionOperation v-if="multipleOperation && selectionMode === 'multiple' && selectionData?.length > 0"
      v-model:selection="selectionData" :total="tableList.length" :operation="_getOperation(selectionData)"
      @batch-operation="batchOperation">
      <template #custom-operation>
        <slot name="multiple-operation" :selection="selectionData" :clear-selection="_clearSelection" />
      </template>
    </SelectionOperation>
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

  &-cell {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    color: var(--Colors-Text-text-primary, #171c1f);
    font-family: Inter;
    font-size: 12px;
    font-style: normal;
    font-weight: 400;
    line-height: 16px;
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
