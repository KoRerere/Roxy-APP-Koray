<script setup lang="ts">
import type { DataTableSelectAllChangeEvent, DataTableSortEvent } from 'primevue/datatable'
import type { MenuItemCommandEvent } from 'primevue/menuitem'
import type { ActionsItem, LabTableActionScope, LabTableChrome, LabTableColumn, LabTableModel, LabTableSortInit } from './type'
import type { SortOrderNumber } from '/@/utils'
import { getFormData, getSortIcon, isLikeFunction, transformSortOrder } from '/@/utils'
import { RxSvgIcon } from '/@/components/rx-icon'

// ============== 头部 ==============
import Display from './display.vue'
import { saveDisplaySettings, setDisplay } from './utils'

// ============== 操作部分 ==============
import Actions from './actions.vue'
import SelectionActions from './selection-actions.vue'
import { isMenuItemVisible, prepareActions } from './actions-model'
import { createActionScopes } from './action-lock'
import { clearTableScroll, dropTableMemory, peekTableScroll, readTableMemory, writeTableMemory, writeTableScroll, type LabTableMemory } from './list-cache'
import { usePreventMask } from '/@/hooks/usePreventMask'

// ========================= 分页 ==============
import TablePaginator from './table-paginator.vue'

// ======================= 生成数据 =======================
import TableFilter from './table-filter.vue'
import TableReload from './table-reload.vue'

defineOptions({ inheritAttrs: false })

const BATCH_SCOPE = 'batch'
const { isBusy: isScopeBusy, run: runScopedAction } = createActionScopes()

const {
  dataKey = 'id',
  cacheKey = '',
  displayKey,
  columns = [],
  dataList,
  model = [],
  selectionMode,
  tableParams,
  immediate = true,
  pageSize = 10,
  loading = 'mask',
  chrome,
  isRowDisabled,
  remember,
  tableRequest = () => ({}),
  tableFilters = () => [],
  tableSort: tableSortProp,
  beforeRefresh,
  afterRefresh,
} = defineProps<Props>()

/** 骨架屏只铺在视图上，不进入真实数据 */
const SKELETON_ROW_COUNT = 6

interface Props {
  dataKey?: string
  cacheKey?: string
  displayKey?: string
  model?: LabTableModel
  columns?: LabTableColumn[]
  /** 传入后走静态数据；不传才使用 tableRequest 的结果 */
  dataList?: any[]
  selectionMode?: 'single' | 'multiple'
  tableParams?: Record<string, any>
  immediate?: boolean
  /** 每页条数，可被 localStorage `table:{cacheKey}` 覆盖 */
  pageSize?: number
  /** mask 为遮罩，skeleton 为列骨架且不写入数据源 */
  loading?: 'mask' | 'skeleton'
  chrome?: LabTableChrome
  /** 命中的行不可选，写入选中集时会被去掉 */
  isRowDisabled?: (row: any) => boolean
  /**
   * 记住这次列表。键由调用方自己拼好（例如带上项目），表格不关心工作区或旧缓存结构。
   * 不传则每次挂载都重新请求。
   */
  remember?: string
  tableRequest?: (data: any) => any | Promise<any>
  tableFilters?: () => any | Promise<any>
  /** 提供后启用服务端排序：与列表请求参数 orderName / orderType 联动 */
  tableSort?: () => LabTableSortInit | Promise<LabTableSortInit | null | undefined> | null | undefined
  beforeRefresh?: () => any | Promise<any>
  afterRefresh?: () => any | Promise<any>
}

/** 父组件传了 v-model:selection 时，请求不能改写调用方持有的选中 */
const selectionBound = hasSelectionBinding(getCurrentInstance()?.vnode.props)

function hasSelectionBinding(rawProps: Record<string, unknown> | null | undefined) {
  if (!rawProps) {
    return false
  }
  return Object.keys(rawProps).some(key => key === 'selection' || key.toLowerCase() === 'onupdate:selection')
}

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
  onRowContextmenu,
  ...attrs,
}

const serverSortEnabled = ref(false)
const _sorts = reactive<{
  sortField: string
  sortOrder: SortOrderNumber
  onChange?: LabTableSortInit['onChange']
}>({
  sortField: '',
  sortOrder: 0,
  onChange: undefined,
})

const chromeView = computed<Required<LabTableChrome>>(() => ({
  header: true,
  reload: true,
  paginator: true,
  actions: true,
  selectionBar: true,
  ...chrome,
}))

const rawColumns = ref(initColumns())

const _tableColumns = computed(() => rawColumns.value.filter(item => item._visible ?? true))

/** 操作列由表格插入；调用方自己声明了 actions 列时不再重复插入 */
const showActionsColumn = computed(() =>
  chromeView.value.actions !== false && !rawColumns.value.some(item => item.field === 'actions'),
)

onBeforeUnmount(() => {
  saveDisplaySettings(displayKey, rawColumns.value)
})

function initColumns() {
  return setDisplay(displayKey, columns.map(column => ({ ...column })))
}

const { showPreventMask, hidePreventMask } = usePreventMask()

const selectionModel = defineModel<any>('selection')
const internalSelection = ref<any>(selectionMode === 'multiple' ? [] : null)

const rootEl = useTemplateRef<HTMLElement>('rootEl')
const ctxmenuRef = useTemplateRef('ctxmenu')
const contextMenuSelection = ref()
const contextModel = ref<ActionsItem[]>([])

function emptySelection() {
  return selectionMode === 'multiple' ? [] : null
}

function isSelectableRow(row: any) {
  return !!row && !isSkeletonPlaceholder(row) && !isRowDisabled?.(row)
}

function selectionKey(value: any) {
  const list = selectionMode === 'multiple'
    ? (Array.isArray(value) ? value : [])
    : (value ? [value] : [])
  return list.map(row => String(row?.[dataKey] ?? '')).join('\0')
}

function stripDisabled(value: any) {
  if (selectionMode === 'multiple') {
    const list = Array.isArray(value) ? value : []
    return list.filter(isSelectableRow)
  }
  if (value && !isSelectableRow(value)) {
    return null
  }
  return value ?? null
}

function writeSelection(value: any) {
  if (selectionBound) {
    selectionModel.value = value
  }
  else {
    internalSelection.value = value
  }
}

const selectionState = computed({
  get() {
    const value = selectionBound ? selectionModel.value : internalSelection.value
    if (selectionMode === 'multiple') {
      return Array.isArray(value) ? value : []
    }
    return value ?? null
  },
  set(value) {
    writeSelection(stripDisabled(value))
  },
})

const selectedRows = computed(() => {
  const usable = stripDisabled(selectionState.value)
  return Array.isArray(usable) ? usable : (usable ? [usable] : [])
})

/** 当前页可选行都在选中集里时表头才勾上，避免禁用行把全选/取消打乱 */
const allSelectableSelected = computed(() => {
  const rows = (viewRows.value ?? []).filter(isSelectableRow)
  if (!rows.length) {
    return false
  }
  const selected = new Set(selectedRows.value.map((row: any) => String(row?.[dataKey] ?? '')))
  return rows.every((row: any) => selected.has(String(row?.[dataKey] ?? '')))
})

function onSelectAllChange(event: DataTableSelectAllChangeEvent) {
  if (!event.checked) {
    clearSelection()
    return
  }
  writeSelection((viewRows.value ?? []).filter(isSelectableRow))
}

watch(
  () => selectionBound ? selectionModel.value : internalSelection.value,
  (value) => {
    const next = stripDisabled(value)
    if (selectionKey(value) === selectionKey(next)) {
      return
    }
    writeSelection(next)
  },
)

function clearSelection() {
  selectionState.value = emptySelection()
}

function rowScope(row: any) {
  return `row:${String(row?.[dataKey] ?? '')}`
}

function actionIdentity(item: ActionsItem) {
  return String(item.key ?? item.icon ?? item.label ?? '')
}

/** 同一行的不同操作、以及批量条上的不同操作，各自一把锁 */
function actionPendingKey(actionScope: string, item: ActionsItem) {
  return `${actionScope}:${actionIdentity(item)}`
}

function isActionPending(item: ActionsItem) {
  return !!item.pendingKey && isScopeBusy(item.pendingKey)
}

function resolveModel(scope: LabTableActionScope) {
  const source = typeof model === 'function' ? model(scope) : model
  const payload = toRaw(scope.row ?? scope.rows)
  const actionScope = scope.row ? rowScope(scope.row) : BATCH_SCOPE
  return prepareActions(source ?? []).map(item => bindActionCommand(item, payload, actionScope))
}

/** 锁挂在这一项的 command 上。重复点同一项会得到 false，其它项照常进入 */
function bindActionCommand(item: ActionsItem, payload: any, actionScope: string): ActionsItem {
  const next: ActionsItem = { ...item, pendingKey: actionPendingKey(actionScope, item) }
  if (item.items?.length) {
    next.items = item.items.map(child => bindActionCommand(child, payload, actionScope))
  }
  if (isLikeFunction(item.command)) {
    const original = item.command
    next.command = async (event: any) => {
      return runScopedAction(next.pendingKey, () => original({ ...event, data: event?.data ?? payload }))
    }
  }
  return next
}

function isBatchMenuItem(item: ActionsItem) {
  return !!item.multiple && !item.onlyQuick
}

function menuItems(scope: LabTableActionScope) {
  const list = resolveModel(scope)
  // 批量更多菜单是全量批量操作，含子菜单；行菜单排除 onlyMultiple。visible 只在这里生效
  const scoped = scope.rows
    ? list.filter(isBatchMenuItem)
    : list.filter(item => !(item.onlyQuick || item.onlyMultiple))
  return scoped.filter(isMenuItemVisible)
}

function hasExecutableAction(items: ActionsItem[]) {
  return items.some(item => !item.separator)
}

function wrapMenuCommand(item: ActionsItem, batch: boolean, data: any): ActionsItem {
  const next: ActionsItem = { ...item }
  if (item.items?.length) {
    next.items = item.items
      .filter(child => isMenuItemVisible(child) && (!batch || child.multiple !== false))
      .map(child => wrapMenuCommand(child, batch, data))
  }
  if (isLikeFunction(item.command)) {
    // 菜单可能在 await 前关掉，选中数据必须在打开时拍下来
    const payload = toRaw(data)
    next.command = async (event: MenuItemCommandEvent) => {
      const result = await item.command?.({ ...event, data: payload })
      if (batch && result !== false) {
        clearSelection()
      }
      return result
    }
  }
  return next
}

async function openContextMenu(originalEvent: Event, scope: LabTableActionScope, data: any) {
  const items = menuItems(scope).map(item => wrapMenuCommand(item, !!scope.rows, data))
  if (!hasExecutableAction(items)) {
    ctxmenuRef.value?.hide()
    return
  }
  contextMenuSelection.value = data
  contextModel.value = items
  await nextTick()
  ctxmenuRef.value?.show(originalEvent)
}

function onRowContextmenu(event: any) {
  const { data, originalEvent } = event
  if (isSkeletonPlaceholder(data) || isRowDisabled?.(data)) {
    return
  }
  openContextMenu(originalEvent, { row: data }, data)
}

function onSelectionContextmenu(event: any) {
  openContextMenu(event.originalEvent, { rows: event.data }, event.data)
}

function menuHasPending(items: ActionsItem[] = contextModel.value): boolean {
  return items.some(item => isActionPending(item) || (item.items?.length ? menuHasPending(item.items) : false))
}

async function onMenuCommand(event: Event, item: any) {
  if (item.items?.length || item.separator || item.disabled || isActionPending(item)) {
    return
  }
  const result = await item.command?.({ originalEvent: event, item })
  if (result !== false && !menuHasPending()) {
    ctxmenuRef.value?.hide()
  }
}

const route = useRoute()
const cachedRows = Number(localStorage.getItem(`table:${cacheKey}`)) || pageSize

const paginatorRows = ref(cachedRows)
const paginatorFirst = ref(cachedRows * ((Number(route.query.page_index) || 1) - 1))
const totalRecords = ref(0)

function onPaginatorUpdate() {
  _request()
}

const _firstLoad = ref(false)
const _loading = ref(false)
const _outerParams = ref()
const _dataList = ref()
const _filters = ref()

const showingSkeleton = computed(() => loading === 'skeleton' && _loading.value)

const sourceRows = computed(() => dataList !== undefined ? dataList : _dataList.value)

/** 骨架行只存在于这次渲染，刷新结束后回到真实数据 */
const viewRows = computed(() => {
  if (showingSkeleton.value) {
    return Array.from({ length: SKELETON_ROW_COUNT }, () => ({}))
  }
  return sourceRows.value
})

const batchModel = computed(() => resolveModel({ rows: selectedRows.value }))

let _getConditionPromise: Promise<any> | undefined

onBeforeMount(async () => {
  _getConditionPromise = _getCondition()
  await _getConditionPromise
  if (tryRestoreMemory()) {
    _firstLoad.value = true
    return
  }
  if (immediate) {
    await _request()
  }
  _firstLoad.value = true
})

onMounted(() => {
  void restoreScrollOffset()
})

watch(sourceRows, () => {
  void restoreScrollOffset()
})

onBeforeUnmount(() => {
  const top = readScrollTop()
  if (top != null) {
    writeTableScroll(remember, top)
  }
})

function onFilterChange() {
  paginatorFirst.value = 0
  _request()
}

async function _getCondition() {
  const [filters, sortInit] = await Promise.all([
    tableFilters(),
    tableSortProp ? tableSortProp() : Promise.resolve(null),
  ])
  _filters.value = filters

  if (sortInit) {
    _sorts.sortField = sortInit.data?.sortField ?? ''
    _sorts.sortOrder = (sortInit.data?.sortOrder ?? 0) as SortOrderNumber
    _sorts.onChange = sortInit.onChange
    serverSortEnabled.value = true
  }
}

function _getParams() {
  const params: Record<string, any> = {
    page_index: Math.ceil(paginatorFirst.value / paginatorRows.value) + 1,
    page_size: paginatorRows.value,
    ...getFormData(_filters.value),
    ...tableParams,
    ..._outerParams.value,
  }
  if (serverSortEnabled.value && _sorts.sortField) {
    params.orderName = _sorts.sortField
    const orderType = transformSortOrder(_sorts.sortOrder)
    if (orderType) {
      params.orderType = orderType
    }
  }
  return params
}

async function _onSortChange(event: DataTableSortEvent) {
  if (!serverSortEnabled.value) {
    return
  }
  _sorts.sortField = (event.sortField as string) ?? ''
  _sorts.sortOrder = (event.sortOrder ?? 0) as SortOrderNumber
  paginatorFirst.value = 0
  await _sorts.onChange?.({ sortField: _sorts.sortField, sortOrder: _sorts.sortOrder })
  await _request()
}

function collectFilterValues() {
  const values: Record<string, unknown> = {}
  for (const item of _filters.value ?? []) {
    if (item?.name) {
      values[item.name] = item.value
    }
  }
  return values
}

function applyFilterValues(values: Record<string, unknown> | undefined) {
  if (!values) {
    return
  }
  for (const item of _filters.value ?? []) {
    if (item?.name && Object.prototype.hasOwnProperty.call(values, item.name)) {
      item.value = values[item.name]
    }
  }
}

function collectMemory(): Omit<LabTableMemory, 'scrollTop'> {
  return {
    rows: _dataList.value ?? [],
    total: totalRecords.value,
    page: { first: paginatorFirst.value, size: paginatorRows.value },
    params: { ...(_outerParams.value ?? {}) },
    filters: collectFilterValues(),
    sort: { field: _sorts.sortField, order: _sorts.sortOrder },
  }
}

function applyMemory(snapshot: LabTableMemory) {
  _outerParams.value = { ...snapshot.params }
  paginatorFirst.value = snapshot.page.first
  if (snapshot.page.size) {
    paginatorRows.value = snapshot.page.size
  }
  totalRecords.value = snapshot.total
  _dataList.value = snapshot.rows
  if (snapshot.sort?.field) {
    _sorts.sortField = snapshot.sort.field
    _sorts.sortOrder = snapshot.sort.order
    serverSortEnabled.value = true
  }
  applyFilterValues(snapshot.filters)
}

/** 静态 dataList 不记快照，避免盖住调用方正在编辑的数组 */
function tryRestoreMemory() {
  if (dataList !== undefined) {
    return false
  }
  const snapshot = readTableMemory(remember)
  if (!snapshot) {
    return false
  }
  applyMemory(snapshot)
  return true
}

/** PrimeVue 普通表和虚拟列表的滚动节点不是同一个，只在这里认 */
function findTableScroller() {
  const root = rootEl.value
  if (!root) {
    return null
  }
  return root.querySelector<HTMLElement>('.p-virtualscroller')
    ?? root.querySelector<HTMLElement>('.p-datatable-table-container')
}

function readScrollTop() {
  return findTableScroller()?.scrollTop
}

let scrollTicket = 0

/** 虚拟列表的占位高度是后补上的，scrollTop 写早了会被钳成 0 */
async function restoreScrollOffset() {
  const offset = peekTableScroll(remember)
  if (!offset) {
    return
  }
  const ticket = ++scrollTicket
  const deadline = performance.now() + 480
  while (performance.now() < deadline) {
    if (ticket !== scrollTicket) {
      return
    }
    await nextTick()
    const el = findTableScroller()
    if (el && el.scrollHeight - el.clientHeight >= offset) {
      el.scrollTop = offset
      if (el.scrollTop > 0) {
        clearTableScroll(remember)
        return
      }
    }
    await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
  }
}

async function _request() {
  _loading.value = true
  try {
    await _getConditionPromise
    const response = await tableRequest(_getParams())
    const failed = typeof response?.code === 'number' && response.code !== 0
    const data = response?.data ?? response
    _dataList.value = data?.rows || []
    totalRecords.value = data?.total ?? 0
    if (!selectionBound) {
      internalSelection.value = emptySelection()
    }
    if (!failed && dataList === undefined) {
      writeTableMemory(remember, collectMemory())
    }
  }
  finally {
    _loading.value = false
  }
}

async function _onRefresh(dropMemory = false) {
  // 只有用户点刷新才丢掉整条记忆。筛选、翻页、外部 refresh 成功后直接覆盖
  if (dropMemory) {
    dropTableMemory(remember)
  }
  await beforeRefresh?.()
  await _request()
  await afterRefresh?.()
}

function isSkeletonPlaceholder(row: any) {
  const v = row?.[dataKey]
  return v === undefined || v === null || v === ''
}

defineExpose({
  getParams: _getParams,
  getColumns: () => rawColumns.value,
  getRows: () => sourceRows.value ?? [],
  clearSelection,
  refresh: async (outerParams = {}, force = true) => {
    if (force) {
      paginatorFirst.value = 0
    }
    _outerParams.value = outerParams
    await _onRefresh()
  },
  update: (nextRows: any[]) => {
    _dataList.value = nextRows || []
  },
})
</script>

<template>
  <div ref="rootEl" class="w-full h-full flex flex-col" :class="wrapClass">
    <div v-if="chromeView.header" class="w-full px-6 py-2 flex flex-wrap items-start justify-between gap-2">
      <slot name="header">
        <div class="flex flex-1 flex-wrap items-center gap-2 min-w-0 basis-64">
          <slot name="filter-before" />
          <TableFilter v-if="_filters?.length" :filters="_filters" @change="onFilterChange" />
          <slot name="filter-after" />
        </div>
        <div class="ml-auto flex shrink-0 items-center gap-2">
          <slot name="toolbar" />
          <Display
            v-if="displayKey"
            v-model="rawColumns"
            :sort-field="serverSortEnabled ? _sorts.sortField : ''"
            :sort-order="serverSortEnabled ? _sorts.sortOrder : 0"
          />
          <RxDivider v-if="displayKey && chromeView.reload" class="!h-5" vertical line-only />
          <TableReload v-if="chromeView.reload" :loading="_loading" @click="_onRefresh(true)" />
        </div>
      </slot>
    </div>

    <div class="relative flex-1 overflow-hidden">
      <DataTable
        v-bind="tableAttrs"
        v-model:selection="selectionState"
        :selection-mode="showingSkeleton ? undefined : selectionMode"
        :select-all="allSelectableSelected"
        :value="viewRows"
        :context-menu-selection="contextMenuSelection"
        :sort-field="serverSortEnabled ? _sorts.sortField : undefined"
        :sort-order="serverSortEnabled ? _sorts.sortOrder : undefined"
        :pt="{
          root: $style.tableroot,
          table: [$style.table, { 'flex-1 !h-full': !viewRows?.length }],
          emptymessagecell: '!whitespace-normal !text-center',
          tbody: $style.tbody,
          headerrow: $style.headerrow,
          bodyrow: (options: any) => {
            const row = options.props.rowData
            const disabled = isSkeletonPlaceholder(row) || !!isRowDisabled?.(row)
            return { class: [$style.bodyrow, disabled && 'row-disabled'], dataRowId: row?.[dataKey] }
          },
        }"
        @sort="_onSortChange"
        @select-all-change="onSelectAllChange"
      >
        <template v-if="_firstLoad && !showingSkeleton" #empty>
          <slot name="empty" />
        </template>

        <slot name="column-before" :pt-props="{ headercell: $style.headercell, bodycell: $style.bodycell }" />

        <Column v-if="selectionMode && !showingSkeleton" :selection-mode="selectionMode" header-style="width:0%" body-style="width:0%"
                :pt="{ headercell: $style.headercell, bodycell: $style.bodycell }"
        >
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
          bodycell: { class: [$style.bodycell, $style.body_text], ...col.cellProps },
        }"
        >
          <template #header>
            <component :is="headerRender" v-if="headerRender" :column="col" />
            <slot v-else :name="headerSlot" :column="col">
              {{ col.header }}
            </slot>
          </template>
          <template v-if="serverSortEnabled && col.props?.sortable" #sorticon="{ sorted, sortOrder: colSortOrder, ...rest }">
            <div :class="rest.class">
              <RxSvgIcon :name="getSortIcon((sorted ? colSortOrder : 0) as SortOrderNumber)" size="12px" color="var(--colors-icon-icon-note)" />
            </div>
          </template>
          <template #body="{ data, index }">
            <template v-if="isSkeletonPlaceholder(data)">
              <Skeleton v-if="col.skeleton" v-bind="col.skeleton" />
              <Skeleton v-else width="60%" height="1rem" />
            </template>
            <template v-else>
              <component :is="render" v-if="render" :column="col" :data="data" :index="index" />
              <slot v-else :name="slot" :column="col" :data="data" :index="index">
                {{ col.getText?.(data) || data[col.field] }}
              </slot>
            </template>
          </template>
        </Column>

        <Column v-if="showActionsColumn" field="actions" :header="$t('操作')" frozen align-frozen="right" header-style="width: 0rem; min-width: 120px"
                :pt="{ headercell: $style.headercell, columnheadercontent: $style.header_text, bodycell: { class: [$style.bodycell, $style.body_text] } }"
        >
          <template #body="{ data, index }">
            <Skeleton v-if="isSkeletonPlaceholder(data)" width="4rem" height="1rem" />
            <slot v-else name="actions" :data="data" :index="index" :is-pending="isActionPending">
              <Actions
                :model="resolveModel({ row: data })"
                :data="data"
                :is-pending="isActionPending"
                :show-menu="chromeView.actions !== 'quick'"
                @more="onRowContextmenu({ originalEvent: $event, data, index })"
              />
            </slot>
          </template>
        </Column>
      </DataTable>

      <SelectionActions
        v-if="chromeView.selectionBar && selectionMode === 'multiple' && selectedRows.length > 0"
        v-model:selection="selectionState"
        :total="sourceRows?.length ?? 0"
        :model="batchModel"
        :is-pending="isActionPending"
        @more="onSelectionContextmenu({ originalEvent: $event, data: selectedRows })"
      >
        <slot name="selection-actions" :selection="selectedRows" :clear="clearSelection" />
      </SelectionActions>

      <RxLoading v-if="loading !== 'skeleton'" v-model="_loading" :opacity="0.9" />
    </div>

    <TablePaginator v-if="chromeView.paginator" v-model:first="paginatorFirst" v-model:rows="paginatorRows" :cache-key="cacheKey" :total-records="totalRecords" @update="onPaginatorUpdate" />

    <ContextMenu ref="ctxmenu" :model="contextModel" :pt="{ root: '!border-0.5' }" @show="showPreventMask" @before-hide="hidePreventMask" @hide="contextMenuSelection = null">
      <template #item="{ item, props }">
        <div v-if="item.separator" class="w-full h-px bg-[var(--colors-border-border-subtle,#e6e8ea)] my-1" />
        <div v-else-if="item.render" class="w-full" @click.stop>
          <component :is="item.render" :item="item" />
        </div>
        <a v-else-if="item.items?.length" v-bind="props.action" class="!pa-0">
          <div class="flex items-center w-full gap-1.5 px-2.5 py-2 text-13px">
            <RxSvgIcon v-if="item.icon" :name="item.icon" :class="item.iconClass" />
            <span class="flex-1">{{ item.label }}</span>
            <RxSvgIcon name="base/rx_ic_chevron_right" />
          </div>
        </a>
        <div
          v-else
          v-tooltip="{ value: item.menuTooltip, delay: 300 }"
          class="flex items-center w-full gap-1.5 px-2.5 py-2 text-13px cursor-pointer"
          :class="{ 'opacity-40 pointer-events-none': item.disabled || isActionPending(item) }"
          @click.stop="onMenuCommand($event, item)"
        >
          <RxSvgIcon
            v-if="item.icon || isActionPending(item)"
            :name="isActionPending(item) ? 'base/rx_ic_progress_bar' : item.icon"
            :class="[item.iconClass, isActionPending(item) && 'animate-spin']"
          />
          <span class="flex-1">{{ item.label }}</span>
          <div v-if="item.suffixLabel || item.suffixIcon" class="flex items-center gap-1 shrink-0">
            <RxSvgIcon v-if="item.suffixIcon" :name="item.suffixIcon" :class="item.iconClass" />
            <span v-if="item.suffixLabel" :class="item.suffixLabelClass">{{ item.suffixLabel }}</span>
          </div>
        </div>
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
