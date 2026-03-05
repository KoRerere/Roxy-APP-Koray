<script setup lang="ts">
import { getFormData, isLikeFunction } from '/@/utils'
import type { MenuItem, MenuItemCommandEvent } from 'primevue/menuitem'

interface Props {
  dataKey?: string
  cacheKey?: string
  displayKey?: string
  model?: MenuItem[]
  columns?: any[]
  dataList?: any[]
  selectionMode?: 'single' | 'multiple'
  tableParams?: Record<string, any>
  immediate?: boolean
  tableRequest?: (data: any) => any | Promise<any>
  tableFilters?: () => any | Promise<any>
  beforeRefresh?: () => any | Promise<any>
  afterRefresh?: () => any | Promise<any>
}

defineOptions({ inheritAttrs: false })

const {
  dataKey = 'id',
  cacheKey = '',
  displayKey,
  columns = [],
  dataList = [],
  model: originalModel = [],
  selectionMode,
  tableParams,
  immediate = true,
  tableRequest = () => ({}),
  tableFilters = () => [],
  beforeRefresh,
  afterRefresh,
} = defineProps<Props>()

const { class: wrapClass, ...attrs } = useAttrs()

const tableAttrs = {
  dataKey,
  scrollable: true,
  scrollHeight: 'flex',
  contextMenu: true,
  showGridlines: false,
  resizableColumns: true,
  columnResizeMode: 'expand',
  selectionMode,
  onRowContextmenu: onRowContextmenu,
  // sortOrder:'',
  // sortField:'',
  // onSort: () => { },
  ...attrs
}

//============== 头部 ==============
import Display from './display.vue'
import { setDisplay, saveDisplaySettings } from './utils'

const rawColumns = ref(initColumns())

const _tableColumns = computed(() => rawColumns.value.filter((item: any) => item._visible ?? true))

onBeforeUnmount(() => {
  saveDisplaySettings(displayKey, rawColumns.value)
})

function initColumns() {
  const _columns = columns.some(item => item.field === 'actions')
    ? [...columns]
    : columns.concat({
      header: 'Actions',
      field: 'actions',
      props: {
        frozen: true,
        alignFrozen: 'right',
        headerStyle: 'width: 0rem; min-width: 120px',
        pt: {},
      },
      render: ({ data, index }: { data: any, index: number }) => h(Actions, {
        model: originalModel,
        data,
        onMore: (event: any) => onRowContextmenu({ originalEvent: event, data, index })
      })
    })

  return setDisplay(displayKey, _columns)
}

//============== 操作部分 ==============
import Actions from './actions.vue'
import SelectionActions from './selection-actions.vue'
import { usePreventMask } from '/@/hooks/usePreventMask'

const { showPreventMask, hidePreventMask } = usePreventMask()

const selectedProduct = defineModel<any>('selection')

const ctxmenuRef = useTemplateRef('ctxmenu')
const contextMenuSelection = ref()
const isSelectionContextmenu = ref(false)

const contextModel = originalModel.filter(item => !(item.onlyQuick || item.onlyMultiple)).map(item =>
  item.hasOwnProperty('command') && isLikeFunction(item.command)
    ? {
      ...item,
      command: async (event: MenuItemCommandEvent) => {
        const result: unknown = await item.command!({ ...event, data: toRaw(contextMenuSelection.value) })
        if (isSelectionContextmenu.value) {
          isSelectionContextmenu.value = false
          if (result !== false) {
            selectedProduct.value = []
          }
        }
      }
    }
    : item
)

function onRowContextmenu(event: any) {
  const { data, originalEvent } = event
  contextMenuSelection.value = data
  ctxmenuRef.value?.show(originalEvent)
}

function onSelectionContextmenu(event: any) {
  isSelectionContextmenu.value = true
  onRowContextmenu(event)
}

function getMenuProps(item: any, extra: any = {}) {
  const { icon, label, disabled } = item
  return {
    icon,
    label,
    disabled,
    ...extra
  }
}

async function onMenuCommand(event: Event, item: any) {
  await item.command?.({ originalEvent: event, item })
  ctxmenuRef.value?.hide()
}

//========================= 分页 ==============
import TablePaginator from './table-paginator.vue'

const route = useRoute()
const cachedRows = Number(localStorage.getItem(`table:${cacheKey}`)) || 10

const paginatorRows = ref(cachedRows)
const paginatorFirst = ref(cachedRows * ((Number(route.query.page_index) || 1) - 1))
const totalRecords = ref(0)

function onPaginatorUpdate() {
  _request()
}

// ======================= 生成数据 =======================
import TableFilter from './table-filter.vue'
import TableReload from './table-reload.vue'

const _firstLoad = ref(false)
const _loading = ref(false)
const _outerParams = ref()
const _dataList = ref()
const _filters = ref()

const _tableValue = computed(() => Array.isArray(dataList) ? dataList : _dataList.value)

let _getConditionPromise: Promise<any> | undefined

onBeforeMount(async () => {
  _getConditionPromise = _getCondition()
  if (immediate) {
    await _request()
  }
  _firstLoad.value = true
})

function onFilterChange() {
  paginatorFirst.value = 0
  _request()
}

async function _getCondition() {
  const filters = await tableFilters()
  _filters.value = filters
}

function _getParams() {
  return {
    page_index: Math.ceil(paginatorFirst.value / paginatorRows.value) + 1,
    page_size: paginatorRows.value,
    ...getFormData(_filters.value),
    ...tableParams,
    ..._outerParams.value,
  }
}

async function _request() {
  _loading.value = true
  await _getConditionPromise
  const { data } = await tableRequest(_getParams())
  _loading.value = false
  _dataList.value = data?.rows || []
  totalRecords.value = data?.total ?? 0
  selectedProduct.value = undefined
}

async function _onRefresh() {
  await beforeRefresh?.()
  await _request()
  await afterRefresh?.()
}

defineExpose({
  getParams: _getParams,
  getColumns: () => rawColumns.value,
  refresh: async (outerParams = {}, force = true) => {
    if (force) paginatorFirst.value = 0
    _outerParams.value = outerParams
    await _onRefresh()
  },
  update: (dataList: any[]) => {
    _dataList.value = dataList || []
  },
})
</script>

<template>
  <div class="w-full h-full flex flex-col" :class="wrapClass">

    <div class="w-full h-10 px-6 flex justify-end items-center">
      <div class="flex-1 flex flex-wrap gap-2">
        <slot name="filter-before"></slot>
        <TableFilter v-if="_filters" :filters="_filters" @change="onFilterChange" />
        <slot name="filter-after"></slot>
      </div>
      <div class="flex items-center gap-2">
        <Display v-if="displayKey" v-model="rawColumns"></Display>
        <RxDivider class="!h-5" vertical line-only />
        <TableReload :loading="_loading" @click="_onRefresh" />
      </div>
    </div>

    <div class="relative flex-1 overflow-hidden">
      <DataTable :value="_tableValue" v-bind="tableAttrs" v-model:selection="selectedProduct" :contextMenuSelection="contextMenuSelection" :pt="{
        root: $style.tableroot,
        table: [$style.table, { 'flex-1 !h-full': _tableValue?.length }],
        emptymessagecell: '!whitespace-normal !text-center',
        tbody: $style.tbody,
        headerrow: $style.headerrow,
        bodyrow: (options: any) => ({ class: $style.bodyrow, dataRowId: options.props.rowData[dataKey] }),
      }">
        <Column v-if="!!tableAttrs.selectionMode" :selectionMode="tableAttrs.selectionMode" headerStyle="width:0%" bodyStyle="width:0%"
          :pt="{ headercell: $style.headercell, bodycell: $style.bodycell }">
          <template #headercheckboxicon="{ checked }">
            <SvgIcon v-show="checked" name="base/rx_ic_checkmark" color="#ffffff" />
          </template>
          <template #rowcheckboxicon="{ checked }">
            <SvgIcon v-show="checked" name="base/rx_ic_checkmark" color="#ffffff" />
          </template>
        </Column>

        <Column v-for="{ headerRender, headerSlot, render, slot, ...col } of _tableColumns" :key="col.field" v-bind="col.props" :field="col.field" :pt="{
          headercell: $style.headercell,
          columnheadercontent: $style.header_text,
          bodycell: { class: [$style.bodycell, $style.body_text], ...col.cellProps }
        }">
          <template #header>
            <component v-if="headerRender" :is="headerRender" :column="col"></component>
            <slot v-else :name="headerSlot" :column="col">
              {{ col.header }}
            </slot>
          </template>
          <template #body="{ data, index }">
            <component v-if="render" :is="render" :column="col" :data="data" :index="index"></component>
            <slot v-else :name="slot" :column="col" :data="data" :index="index">
              {{ col.getText?.(data) || data[col.field] }}
            </slot>
          </template>
        </Column>
      </DataTable>

      <SelectionActions v-if="tableAttrs.selectionMode === 'multiple' && selectedProduct?.length > 0" v-model:selection="selectedProduct" :total="10" :model="originalModel"
        @more="onSelectionContextmenu({ originalEvent: $event, data: selectedProduct })"></SelectionActions>

      <RxLoading v-model="_loading" :opacity="0.9"></RxLoading>
    </div>

    <TablePaginator v-model:first="paginatorFirst" v-model:rows="paginatorRows" :cacheKey="cacheKey" :totalRecords="totalRecords" @update="onPaginatorUpdate"></TablePaginator>

    <ContextMenu ref="ctxmenu" :model="contextModel" :pt="{ root: '!border-0.5' }" @show="showPreventMask" @before-hide="hidePreventMask" @hide="contextMenuSelection = null">
      <template #item="{ item, props }">
        <RxButton class="w-full !justify-start" v-bind="getMenuProps(item, props.action)" text severity="secondary" @click.stop="onMenuCommand($event, item)" />
      </template>
    </ContextMenu>
  </div>
</template>

<style lang="scss" module>
.header_text {
  font-family: Inter;
  font-size: 12px;
  line-height: normal;
  font-weight: 600;
}

.body_text {
  font-family: Inter;
  font-size: 12px;
  font-weight: 500;
  line-height: normal;
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

.headerrow .headercell {
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

.bodyrow .bodycell {
  height: 60px;
  border-bottom-width: 0.5px;

  &:first-of-type {
    padding-left: 24px;
  }

  &:global(.p-datatable-frozen-column) {
    padding-left: 16px;
    background: var(--colors-background-bg-page);
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
</style>
