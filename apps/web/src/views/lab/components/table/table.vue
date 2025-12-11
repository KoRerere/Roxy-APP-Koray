<script setup lang="ts">
import type { MenuItem, MenuItemCommandEvent } from 'primevue/menuitem'
import { getFormData, isLikeFunction } from '/@/utils'
import RxButton from '/@/components/rx-button'

interface Props {
  dataKey?: string
  cacheKey?: string
  displayKey?: string
  model?: any[]
  columns?: any[]
  dataList?: any[]
  selectionMode?: 'single' | 'multiple'
  tableParams?: Record<string, any>
  tableRequest?: (data: any) => any | Promise<any>
  tableFilters?: () => any | Promise<any>
  immediate?: boolean
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
  tableRequest = () => ({}),
  tableFilters = () => [],
  immediate = true
} = defineProps<Props>()

const { class: wrapClass, ...attrs } = useAttrs()

const tableAttrs = {
  dataKey,
  scrollable: true,
  scrollHeight: 'flex',
  contextMenu: true,
  showGridlines: true,
  resizableColumns: true,
  columnResizeMode: 'expand',
  selectionMode,
  onRowContextmenu: onRowContextmenu,
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
  _loading.value = true
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
  await _getConditionPromise
  _loading.value = true
  const { data } = await tableRequest(_getParams())
  _loading.value = false
  _dataList.value = data?.rows || []
  totalRecords.value = data?.total ?? 0
  selectedProduct.value = undefined
}

defineExpose({
  getParams: _getParams,
  getColumns: () => rawColumns.value,
  refresh: (outerParams = {}, force = true) => {
    if (force) paginatorFirst.value = 0
    _outerParams.value = outerParams
    _request()
  },
  update: (dataList: any[]) => {
    _dataList.value = dataList || []
  },
})
</script>

<template>
  <div class="w-full h-full flex flex-col" :class="wrapClass">

    <div class="w-full h-10 px-4 flex justify-end items-center bg-blue">
      <div class="flex-1 flex flex-wrap gap-2">
        <slot name="filter-before"></slot>
        <TableFilter v-if="_filters" :filters="_filters" @change="onFilterChange" />
        <slot name="filter-after"></slot>
      </div>
      <div class="flex items-center gap-2">
        <Display v-if="displayKey" v-model="rawColumns"></Display>
        <RxDivider class="!h-5" vertical line-only />
        <TableReload :loading="_loading" @click="_request" />
      </div>
    </div>

    <div class="relative flex-1 overflow-hidden">
      <DataTable :value="_tableValue" v-bind="tableAttrs" v-model:selection="selectedProduct">
        <Column v-if="!!tableAttrs.selectionMode" :selectionMode="tableAttrs.selectionMode" headerStyle="width:0%" bodyStyle="width:0%">
          <template #headercheckboxicon="{ checked }">
            <SvgIcon v-show="checked" name="base/rx_ic_checkmark" color="#ffffff" />
          </template>
          <template #rowcheckboxicon="{ checked }">
            <SvgIcon v-show="checked" name="base/rx_ic_checkmark" color="#ffffff" />
          </template>
        </Column>

        <Column v-for="{ headerRender, headerSlot, render, slot, ...col } of _tableColumns" :key="col.field" :field="col.field" v-bind="col.props">
          <template #header>
            <component v-if="headerRender" :is="headerRender"></component>
            <slot v-else :name="headerSlot" :column="col">
              <div>{{ col.header }}</div>
            </slot>
          </template>
          <template #body="{ data, index }">
            <component v-if="render" :is="render" :data="data" :index="index"></component>
            <slot v-else :name="slot" :column="col" :data="data" :index="index">
              <div>{{ data[col.field] }}</div>
            </slot>
          </template>
        </Column>
      </DataTable>
      <SelectionActions v-if="tableAttrs.selectionMode === 'multiple' && selectedProduct?.length > 0" v-model:selection="selectedProduct" :total="10" :model="originalModel"
        @more="onSelectionContextmenu({ originalEvent: $event, data: selectedProduct })"></SelectionActions>
      <RxLoading v-model="_loading" :opacity="0.9"></RxLoading>
    </div>

    <TablePaginator v-model:first="paginatorFirst" v-model:rows="paginatorRows" :cacheKey="cacheKey" :totalRecords="totalRecords" @update="onPaginatorUpdate"></TablePaginator>

    <ContextMenu ref="ctxmenu" :model="(contextModel as MenuItem[])" @hide="contextMenuSelection = null">
      <template #item="{ item, props }">
        <RxButton class="w-full !justify-start" v-bind="getMenuProps(item, props.action)" text severity="secondary" @click.stop="onMenuCommand($event, item)" />
      </template>
    </ContextMenu>
  </div>
</template>

<style scoped></style>
