<script setup lang="ts">
import RxInputSelect from '/@/components/ry-form/rx-input-select.vue'
import SelectionOperation from './selection-operation.vue'
import TableDisplay from './table-display.vue'
import TableFilter from './table-filter.vue'
import TableReload from './table-reload.vue'
import type { DataTableRowContextMenuEvent, DataTableSortEvent } from 'primevue/datatable'
import type { PageState } from 'primevue/paginator'
import type { SelectChangeEvent } from 'primevue/select'
import { useContextMenu } from '/@/components/rx-ctxmenu'

import { deepClone, getFormData, getSortIcon, isEmptyValue, isFunction, isLikeFunction, operationPower, transformSortOrder } from '/@/utils'
import type { Operation, SortOrderNumber } from '/@/utils'
import { RxSvgIcon } from '/@/components/rx-icon'
import { AnimatePresence } from 'motion-v'

defineOptions({
  inheritAttrs: false,
})

const props = withDefaults(defineProps<Props>(), {
  dataKey: 'id',
  cacheKey: '',
  immediate: true,
  multipleOperation: true,
  paginator: true,
  showTableHeader: true,
  showDisplay: true,
  showReload: true,
  showActions: true,
  showActionsMenu: true,
  pageRows: 10,
  tableRequest: () => ({}),
  tableSort: () => [],
  tableFilters: () => [],
  tableOperation: () => [],
})

const columns = defineModel<any[]>('columns', { required: true })

export interface Props {
  dataKey?: string
  cacheKey?: string
  dataList?: any[]
  operation?: Operation[]
  tableParams?: Record<string, any>
  selectionMode?: 'single' | 'multiple'
  immediate?: boolean
  multipleOperation?: boolean
  paginator?: boolean
  showTableHeader?: boolean
  showDisplay?: boolean
  showReload?: boolean
  showActions?: boolean
  showActionsMenu?: boolean
  skeleton?: boolean
  pageRows?: number
  tableSort?: () => any
  tableFilters?: () => any
  tableRequest?: (data: any) => any | Promise<any>
  tableOperation?: (data: any) => Operation[]
  operationHandler?: (event: Event, data: any, operationType: 'single' | 'batch') => any | Promise<any>
  beforeRefresh?: () => any | Promise<any>
  afterRefresh?: () => any | Promise<any>
}

const route = useRoute()
const [showContextMenu] = useContextMenu()
const columnCss = useCssModule('ColumnCss_Module')
const rootElRef = useTemplateRef('rootEl')

let _getConditionPromise: Promise<any> | undefined
const _firstLoad = ref(false)
const _loading = ref(false)
const _columns = computed(() => columns.value.filter((item: any) => item._visible ?? true))
const _dataList = ref()
const _filters = ref()
const _outerParams = ref()
const _selectionDisableds = ref<string[]>([])
const _sorts = reactive<{
  sortField: string
  sortOrder: SortOrderNumber
  onChange: ((data: { sortField: string, sortOrder: SortOrderNumber }) => void) | undefined
}>({
  sortField: '',
  sortOrder: 0,
  onChange: undefined,
})

const tableList = computed(() => Array.isArray(props.dataList) ? props.dataList : _dataList.value)

const { selection: outerSelection, 'onUpdate:selection': onUpdateSelection, ...attrs } = toRefs(reactive(useAttrs()))

const tableAttrs = reactive({
  dataKey: props.dataKey,
  scrollable: true,
  scrollHeight: 'flex',
  contextMenu: true,
  showGridlines: false,
  resizableColumns: true,
  columnResizeMode: 'expand',
  selectionMode: props.selectionMode,
  onRowSelectAll: async () => {
    await nextTick()
    const disableds: any[] = []
    document.querySelectorAll('.p-datatable-selectable-row.row-disabled').forEach((tr) => {
      disableds.push(tr.getAttribute('data-row-id'))
      const checkboxChecked = tr.querySelector<HTMLDivElement>('.p-checkbox-checked')
      if (checkboxChecked) {
        checkboxChecked.classList.remove('p-checkbox-checked')
        const checkboxIcon = checkboxChecked.querySelector<HTMLDivElement>('.p-checkbox-icon')
        if (checkboxIcon) {
          checkboxIcon.style.display = 'none'
        }
      }
    })
    _selectionDisableds.value = disableds
  },
  ...attrs,
})

const hasOuterSelection = isFunction(onUpdateSelection?.value)
const innerSelection = ref()

const selectionData = computed({
  get() {
    return hasOuterSelection ? outerSelection?.value : innerSelection.value
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
// primevue 缺少 row disabled 功能，所以需要自己手动过滤 selection 数据用于使用，创造全选的 '假象'
const realUseSelection = computed(() => {
  return selectionData.value?.filter((item: any) => !_selectionDisableds.value.includes(item[props.dataKey].toString()))
})

const cachedRows = Number(localStorage.getItem(`table:${props.cacheKey}`)) || props.pageRows
const paginatorConfig = reactive({
  rows: cachedRows,
  first: cachedRows * ((Number(route.query.page_index) || 1) - 1),
  totalRecords: 0,
  rowsPerPageOptions: [
    { label: $t('5 条/页'), value: 5 },
    { label: $t('10 条/页'), value: 10 },
    { label: $t('20 条/页'), value: 20 },
    { label: $t('50 条/页'), value: 50 },
    { label: $t('100 条/页'), value: 100 },
  ],
  onResetPage(first = 0, rows?: number) {
    paginatorConfig.first = first
    if (rows) {
      paginatorConfig.rows = rows
    }
  },
  onPage(_event: PageState) {
    _request()
  },
  onRowsChange(selectEvent: SelectChangeEvent) {
    if (props.cacheKey && selectEvent.value) {
      localStorage.setItem(`table:${props.cacheKey}`, selectEvent.value)
    }
    paginatorConfig.first = 0
    _request()
  },
})
const paginatorInfo = computed(() => $t('总计 {total} 个', {
  total: paginatorConfig.totalRecords,
}))

onBeforeMount(async () => {
  _getConditionPromise = _getCondition()
  if (props.immediate) {
    await _request()
  }
  _firstLoad.value = true
})

function fmtColumnProps(column: Record<string, any>) {
  const { key, style, alignFrozen, pt, ...props } = column
  return {
    field: key,
    headerStyle: style,
    frozen: !!alignFrozen,
    alignFrozen,
    pt: {
      headercell: columnCss.headercell,
      bodycell: columnCss.bodycell,
      ...pt,
    },
    ...props,
  }
}

async function batchOperation(item: any) {
  try {
    await props.operationHandler?.(item, realUseSelection.value, 'batch')
    _clearSelection()
  }
  catch (error) {
    console.log(error)
  }
}

function onFilterChange() {
  paginatorConfig.onResetPage()
  _request()
}

async function _onSortChange(event: DataTableSortEvent) {
  _sorts.sortField = event.sortField as string
  _sorts.sortOrder = event.sortOrder as SortOrderNumber
  paginatorConfig.onResetPage()
  await _sorts.onChange?.({ sortField: _sorts.sortField, sortOrder: _sorts.sortOrder })
  _request()
}

async function _getCondition() {
  const [{ data, onChange }, filterList] = await Promise.all([
    props.tableSort(),
    props.tableFilters(),
  ])
  _filters.value = filterList
  _sorts.sortField = data?.sortField ?? ''
  _sorts.sortOrder = data?.sortOrder ?? 0
  _sorts.onChange = onChange
}

function _getParams() {
  const params = {
    page_index: Math.ceil(paginatorConfig.first / paginatorConfig.rows) + 1,
    page_size: paginatorConfig.rows,
    ...getFormData(_filters.value as any),
    ...props.tableParams,
    ..._outerParams.value,
  }

  if (_sorts.sortField) {
    params.orderName = _sorts.sortField
    params.orderType = transformSortOrder(_sorts.sortOrder)
  }

  return params
}

async function _request() {
  if (props.skeleton) {
    _dataList.value = Array.from({ length: 6 }, () => ({}))
  }
  _loading.value = true
  await _getConditionPromise
  const requestParams = _getParams()
  const { data } = await props.tableRequest(requestParams)
  paginatorConfig.totalRecords = data?.total ?? 0
  _dataList.value = data?.rows || []
  _clearSelection()
  _loading.value = false
}

function _getOperation(data: any) {
  return operationPower(!isEmptyValue(props.operation) ? props.operation! : props.tableOperation(data))
}

function _clearSelection() {
  if (!hasOuterSelection) {
    selectionData.value = undefined
    _selectionDisableds.value = []
  }
}

const contextMenuSelected = ref()

function onRowContextMenu(event: DataTableRowContextMenuEvent) {
  if (!tableAttrs.contextMenu) {
    return
  }

  const operation = _getOperation(event.data)

  if (!operation?.length) {
    return
  }

  let _executing = false

  showContextMenu(event.originalEvent, {
    operation: isLikeFunction(props.operationHandler) ? operation.map(({ command: _command, ...item }) => item) : operation,
    operationHandler: async (operate: any) => {
      try {
        _executing = true
        const _operate = { ...deepClone(toRaw(operate)), _event: event.originalEvent }
        await props.operationHandler?.(_operate, event.data, 'single')
      }
      catch (error) {
        console.log(error)
      }
      finally {
        _executing = false
        contextMenuSelected.value = undefined
      }
    },
    onHide: () => {
      if (!_executing)
        contextMenuSelected.value = undefined
    },
  })
}

function showOperationMenu({ event, operation }: { event: Event, operation: any[] }, data: any, operationType: 'batch' | 'single') {
  showContextMenu(event, {
    operation: isLikeFunction(props.operationHandler) ? operation.map(({ command: _command, ...item }) => item) : operation,
    operationHandler: async (operate: any) => {
      try {
        const _operate = { ...deepClone(toRaw(operate)), _event: event }
        await props.operationHandler?.(_operate, data, operationType)
      }
      catch (error) {
        console.log(error)
      }
    },
  })
}

function _updateDataList(list: any[]) {
  _dataList.value = list || []
}

async function _onRefresh() {
  await props.beforeRefresh?.()
  await _request()
  await props.afterRefresh?.()
}

defineExpose({
  rootElRef,
  selectionData: realUseSelection,
  refresh: async (outerParams = {}, force = true) => {
    _outerParams.value = outerParams
    if (force) {
      paginatorConfig.first = 0
    }
    await _onRefresh()
  },
  clearSelection: _clearSelection,
  updateDataList: _updateDataList,
  getParams: _getParams,
})

const slots: any = useSlots()
const ColumnCss_Module = useCssModule('ColumnCss_Module')

function initBodyrow(options: any) {
  return {
    'class': ColumnCss_Module.bodyrow,
    'data-row-id': options.props.rowData[props.dataKey],
  }
}
</script>

<template>
  <div ref="rootEl" class="position-relative w-full h-full flex flex-col" :class="$attrs.class">
    <div v-if="showTableHeader" class="flex items-start justify-between self-stretch gap-2 rx-header">
      <slot name="table-header">
        <div class="flex flex-1 gap-2 flex-wrap">
          <slot name="filter-before" />
          <TableFilter :filters="_filters" @change="onFilterChange" />
          <slot name="filter-after" />
        </div>
        <div class="flex gap-2 items-center">
          <template v-if="showDisplay">
            <TableDisplay v-model:columns="columns" :sort-field="_sorts.sortField" :sort-order="_sorts.sortOrder">
              <template #before>
                <slot name="display-before" />
              </template>
            </TableDisplay>
            <Divider layout="vertical" class="!mx-0 h-4" />
          </template>
          <TableReload v-if="showReload" :loading="_loading" @click="_onRefresh" />
        </div>
      </slot>
    </div>
    <div class="table-wrapper position-relative flex-1 overflow-hidden">
      <DataTable v-model:context-menu-selection="contextMenuSelected" v-model:selection="selectionData" :value="tableList" v-bind="tableAttrs" :sort-order="_sorts.sortOrder"
                 :sort-field="_sorts.sortField" :pt="{
                   root: ColumnCss_Module.tableroot,
                   table: [ColumnCss_Module.table, !tableList?.length ? 'flex-1 !h-full' : ''],
                   emptymessagecell: '!whitespace-normal !text-center',
                   tbody: ColumnCss_Module.tbody,
                   headerrow: ColumnCss_Module.headerrow,
                   bodyrow: initBodyrow,
                 }" @sort="_onSortChange" @row-contextmenu="onRowContextMenu"
      >
        <template v-for="(_, name) in slots" #[name]="slotProps">
          <slot :name="name" v-bind="slotProps" />
        </template>
        <template v-if="_firstLoad" #empty>
          <slot name="table-empty" />
        </template>

        <slot name="column-before" :pt-props="{ headercell: ColumnCss_Module.headercell, bodycell: ColumnCss_Module.bodycell }" />

        <Column v-if="selectionMode" header-style="width:0%; " body-style="width:0%; " :selection-mode="selectionMode"
                :pt="{ headercell: ColumnCss_Module.headercell, bodycell: ColumnCss_Module.bodycell }"
        >
          <template #headercheckboxicon="{ checked }">
            <SvgIcon v-if="checked" name="base/rx_ic_checkmark" color="#ffffff" />
          </template>
          <template #rowcheckboxicon="{ checked }">
            <SvgIcon v-if="checked" name="base/rx_ic_checkmark" color="#ffffff" />
          </template>
        </Column>

        <Column v-for="{ headerSlot, slot, render, headerRender, ...column } in _columns" :key="column.key" v-bind="fmtColumnProps(column)">
          <template #header>
            <slot :name="headerSlot" :column="column" :class="ColumnCss_Module.columntitle">
              <component :is="headerRender" v-if="headerRender" :column="column" :class="ColumnCss_Module.columntitle" />
              <span v-else :class="ColumnCss_Module.columntitle">{{ column.title }}</span>
            </slot>
          </template>
          <template #body="{ data }">
            <slot :name="slot" :data="data" :column="column">
              <component :is="render" v-if="render" :data="data" :class="column.classes" />
              <template v-else>
                <template v-if="column.skeleton && !data.id">
                  <Skeleton v-bind="column.skeleton" />
                </template>
                <template v-else>
                  <div :style="{ width: `${column.width}px` || 'auto' }" :class="column.classes" :title="column.getText?.(data) || data[column.key]">
                    {{ column.getText?.(data) || data[column.key] }}
                  </div>
                </template>
              </template>
            </slot>
          </template>
          <template #sorticon="{ sorted, sortOrder, ...rest }">
            <div :class="rest.class">
              <RxSvgIcon :name="getSortIcon((sorted ? sortOrder : 0) as SortOrderNumber)" size="12px" color="var(--colors-icon-icon-note)" />
            </div>
          </template>
        </Column>
        <Column v-if="showActions" field="actions" :header="$t('操作')" align-frozen="right" frozen header-style="width: 0px; min-width: 120px" :pt="{
          columntitle: ColumnCss_Module.columntitle,
          headercell: ColumnCss_Module.headercell,
          bodycell: ColumnCss_Module.bodycell,
        }"
        >
          <template #body="{ data }">
            <div class="flex items-center">
              <slot name="actions-extra" :data="data" />
              <slot name="actions" :data="data">
                <Actions :show-menu="showActionsMenu" :operation="_getOperation(data)" @quick-click="operationHandler?.($event, data, 'single')" @more="showOperationMenu($event, data, 'single')" />
              </slot>
            </div>
          </template>
        </Column>
      </DataTable>
      <RxLoading v-if="!skeleton" v-model="_loading" :opacity="0.9" />
    </div>
    <div v-if="paginator" class="rx-paginator">
      <Paginator v-model:first="paginatorConfig.first" template="JumpToPageInput PrevPageLink PageLinks NextPageLink" :page-link-size="5" :rows="paginatorConfig.rows"
                 :total-records="paginatorConfig.totalRecords" @page="paginatorConfig.onPage"
      >
        <template #start>
          <div class="flex flex-1 items-center rx-paginator-jump">
            <div>{{ paginatorInfo }}</div>
            <RxInputSelect v-model="paginatorConfig.rows" name="rowsPerPage" style="width: fit-content;" v-bind="{ size: 'xxs', optionValue: 'value', filter: false }" option-value="value"
                           :options="paginatorConfig.rowsPerPageOptions" @change="paginatorConfig.onRowsChange"
            />
            <div class="flex flex-1 items-center gap-2 justify-end">
              <div>{{ $t('跳转页数至') }}</div>
            </div>
          </div>
        </template>
      </Paginator>
    </div>

    <AnimatePresence>
      <SelectionOperation v-if="multipleOperation && selectionMode === 'multiple' && realUseSelection?.length > 0" :selection="realUseSelection" :total="tableList.length"
                          :operation="_getOperation(realUseSelection)" :batch-operation="batchOperation" @clear-selection="_clearSelection" @batch-more="showOperationMenu($event, realUseSelection, 'batch')"
      >
        <template #custom-operation>
          <slot name="multiple-operation" :selection="realUseSelection" :clear-selection="_clearSelection" />
        </template>
      </SelectionOperation>
    </AnimatePresence>
  </div>
</template>

<style lang="scss" scoped>
.rx-header {
  padding: 12px 24px;
}

.table-wrapper {
  border-top: 0.5px solid var(--component-table-border-header);
}

:deep(.p-checkbox-box) {
  width: 16px;
  height: 16px;
}

:deep(.p-datatable-empty-message) {
  background-color: transparent !important;
}

.rx-paginator {
  :deep(.p-paginator-content-start) {
    flex: 1;
  }

  :deep(.p-paginator-prev),
  :deep(.p-paginator-next),
  :deep(.p-paginator-page) {
    min-width: auto;
    width: 24px;
    height: 24px;
    border-radius: var(--radius-sm, 4px);
  }

  :deep(.p-paginator-page) {
    color: var(--colors-text-text-primary, #111213);
    font-family: Inter;
    font-size: 12px;
    font-weight: 500;
    line-height: 16px;
  }

  :deep(.p-paginator-page-selected) {
    color: var(--colors-text-text-brand, #11a3fd);
    border: 0.5px solid var(--colors-border-border-brand, #11a3fd);
    background: var(--component-button-ghost-bg, #fff);
    border-radius: var(--radius-sm, 4px);
    box-shadow:
      0px 4px 4px -1px rgba(0, 0, 0, 0.02),
      0px 1px 1px 0px rgba(0, 0, 0, 0.06);
  }

  :deep(.p-inputtext) {
    padding: 4px 4px 4px 6px;
    width: 60px;
    border-radius: var(--radius-sm, 4px);
    font-size: 12px;
    line-height: 16px;
  }

  :deep(.p-select) {
    padding: 4px 4px 4px 6px;
    gap: 6px;
    width: 60px;
    border-radius: var(--radius-sm, 4px);

    .p-select-label {
      padding: 0;
    }

    .p-select-dropdown {
      width: auto;
    }
  }

  &-jump {
    display: flex;
    gap: 8px;
    color: var(--colors-text-text-secondary, #34393d);
    font-family: Inter;
    font-size: 12px;
    line-height: 16px;
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

<style lang="scss" module="ColumnCss_Module">
.columntitle {
  font-family: Inter;
  font-size: 12px;
  line-height: 16px;
  font-weight: 600;
}

.headerrow {
  .headercell {
    padding: 8px 12px;
    user-select: none;

    &:first-of-type {
      padding-left: 24px;
    }

    &:global(.p-datatable-frozen-column) {
      padding-left: 16px;
    }

    &:global(.p-datatable-sortable-column) {
      background: var(--datatable-header-cell-background);
      color: var(--datatable-header-cell-color);

      &:not(.p-datatable-column-sorted):hover {
        background: var(--datatable-header-cell-background);
        color: var(--datatable-header-cell-color);
      }
    }
  }
}

.bodyrow {
  .bodycell {
    padding: 0 12px;
    height: 60px;
    border-bottom-width: 0.5px;
    font-size: 12px;
    font-weight: 500;
    line-height: normal;

    &:first-of-type {
      padding-left: 24px;
    }

    &:global(.p-datatable-frozen-column) {
      padding-left: 16px;
      background: var(--colors-background-bg-page, #fff);
      border-left: 1px solid var(--component-table-border-cell);
      box-shadow: -2px 0px 4px 0px rgba(0, 0, 0, 0.05);
      transition:
        background var(--datatable-transition-duration),
        color var(--datatable-transition-duration),
        border-color var(--datatable-transition-duration),
        outline-color var(--datatable-transition-duration),
        box-shadow var(--datatable-transition-duration);
    }
  }
}

.tableroot {
  &:global(.p-datatable-sm) .bodycell {
    height: 40px;
  }

  :global(.p-datatable-scrollable-table > .p-datatable-thead) {
    z-index: 2;
  }

  :global(.row-disabled) {
    pointer-events: none;
    opacity: var(--disabled-opacity);
  }

  .table .tbody .bodyrow {
    &:global(:not(.row-disabled)[data-p-selected='true']) {
      background: var(--component-table-bg-selected);

      .bodycell {
        border-color: var(--component-table-border-selected);

        &:global(.p-datatable-frozen-column) {
          background: var(--component-table-bg-selected);
        }
      }
    }

    &:global(:not(.row-disabled):not([data-p-selected='true']):hover) {
      background: var(--component-table-bg-hover);

      .bodycell {
        border-color: var(--component-table-border-hover);

        &:global(.p-datatable-frozen-column) {
          background: var(--component-table-bg-hover);
        }
      }
    }

    &:global(.p-datatable-contextmenu-row-selected:not(.row-disabled):not([data-p-selected='true'])) {
      outline: none;
      background: var(--component-table-bg-hover);

      .bodycell {
        border-color: var(--component-table-border-hover);

        &:global(.p-datatable-frozen-column) {
          background: var(--component-table-bg-hover);
        }
      }
    }
  }
}
</style>
