<script setup lang="ts">
import type { DataTableRowContextMenuEvent } from 'primevue/datatable'
import type { PageState } from 'primevue/paginator'
import { useContextMenu } from '/@/components/rx-ctxmenu'
import RxInputSelect from '/@/components/ry-form/rx-input-select.vue'
import { $t } from '/@/locales'
import { isEmptyValue, isFunction, operationPower } from '/@/utils'
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

const _loading = ref(false)
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
  rows: 10,
  first: 0,
  totalRecords: 0,
  rowsPerPageOptions: [
    { label: $t('5 条/页'), value: 5 },
    { label: $t('10 条/页'), value: 10 },
    { label: $t('20 条/页'), value: 20 },
    { label: $t('50 条/页'), value: 50 },
    { label: $t('100 条/页'), value: 100 },
  ],
  onResetPage(page: number = 1, rows: number = 10) {
    paginatorConfig.first = 0
    paginatorConfig.page = page
    paginatorConfig.rows = rows
  },
  onPage(event: PageState) {
    paginatorConfig.page = event.page + 1
    _request()
  },
  onRowsChange() {
    paginatorConfig.page = Math.max(Math.ceil(paginatorConfig.first / paginatorConfig.rows), 1)
    _request()
  },
})

const paginatorInfo = computed(() => $t('总计 {total} 个', {
  total: paginatorConfig.totalRecords,
}))

async function batchOperation(item: any) {
  await props.operationHandler(item, selectionData.value)
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
  _loading.value = true
  const { data } = await props.tableRequest(requestParams)
  paginatorConfig.totalRecords = data?.total ?? 0
  _dataList.value = data?.rows || []
  _clearSelection()
  _loading.value = false
}

function _getOperation(data: any) {
  return operationPower(!isEmptyValue(props.operation) ? props.operation : props.tableOperation(data))
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

  const operation = _getOperation(event.data)

  if (!operation?.length) {
    return
  }

  show(event.originalEvent, {
    operation,
    operationHandler: (operate: any) => props.operationHandler(operate, event.data),
  })
}

function showOperationMenu({ event }: { event: Event }, data: any) {
  show(event, {
    operation: _getOperation(data),
    operationHandler: (operate: any) => props.operationHandler(operate, data),
  })
}

onBeforeMount(() => {
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
  <div class="position-relative w-full h-full flex flex-col">
    <div v-if="showTableHeader" class="flex items-center rx-header">
      <div class="flex flex-auto gap-2">
        <TableFilter :filters="_filters" @change="onChangeParams('filters', $event)" />
        <slot name="header-extra" />
      </div>
      <div class="flex gap-2">
        <TableDisplay v-if="showDisplay" :columns="columns" @update:columns="$emit('update:columns', $event)">
          <template v-if="$slots['config-footer']" #footer>
            <slot name="config-footer" />
          </template>
        </TableDisplay>
        <TableSort v-if="sorts.length > 0" :sorts="sorts" @sort="onChangeParams('sort', $event)" />
      </div>
    </div>
    <div class="position-relative flex-1 overflow-hidden">
      <DataTable v-model:selection="selectionData" :value="tableList" v-bind="tableAttrs"
        :pt="{ table: !tableList?.length ? 'flex-1' : '', emptymessagecell: '!whitespace-normal !text-center', bodyrow: Css_Module.bodyrow }" @row-contextmenu="onRowContextMenu">
        <template v-for="(_, name) in $slots" #[name]="slotProps">
          <slot :name="name" v-bind="slotProps" />
        </template>
        <template #empty>
          <slot name="table-empty" />
        </template>
        <Column v-if="selectionMode" header-style="width: 3rem" :pt="{ headercell: Css_Module.headercell, bodycell: Css_Module.bodycell }" :selection-mode="selectionMode" />
        <Column v-for="column in _columns" :key="column.key" :field="column.key" :header="column.title" :header-style="column.style" :frozen="!!column.alignFrozen" :align-frozen="column.alignFrozen"
          :pt="{ columntitle: Css_Module.columntitle, headercell: Css_Module.headercell, bodycell: Css_Module.bodycell }">
          <template #body="{ data }">
            <slot :name="column.slot" :data="data">
              <component :is="column.render" v-if="column.render" :data="data" />
              <div v-else :style="{ width: `${column.width}px` || 'auto' }" :class="[Css_Module.columntitle, column.classes]" :title="column.getText?.(data) || data[column.key]">
                {{ column.getText?.(data) || data[column.key] }}
              </div>
            </slot>
          </template>
        </Column>
        <Column v-if="showActions" field="actions" header="Actions" align-frozen="right" frozen header-style="width: 9rem">
          <template #body="{ data }">
            <div class="flex items-center">
              <slot name="actions-extra" :data="data" />
              <slot name="actions" :data="data">
                <Actions :show-menu="showActionsMenu" :operation="_getOperation(data)" @quick-click="operationHandler($event, data)" @more="showOperationMenu($event, data)" />
              </slot>
            </div>
          </template>
        </Column>
      </DataTable>
      <div v-if="_loading" class="absolute inset-0 flex items-center justify-center z-10 bg-white/90">
        <img class="w-8 h-8 loading-circle" src="/@/assets/images/status/loading.png">
      </div>
    </div>
    <div v-if="paginator" class="rx-paginator">
      <Paginator v-model:first="paginatorConfig.first" template="JumpToPageInput PrevPageLink PageLinks NextPageLink" :page-link-size="5" :rows="paginatorConfig.rows"
        :total-records="paginatorConfig.totalRecords" @page="paginatorConfig.onPage">
        <template #start>
          <div class="flex flex-1 items-center rx-paginator-jump">
            <div>{{ paginatorInfo }}</div>
            <RxInputSelect v-model="paginatorConfig.rows" name="rowsPerPage" style="width: fit-content;" v-bind="{ size: 'xxs', optionValue: 'value', filter: false }" option-value="value"
              :options="paginatorConfig.rowsPerPageOptions" @change="paginatorConfig.onRowsChange" />
            <div class="flex flex-1 items-center gap-2 justify-end">
              <div>{{ $t('跳转页数至') }}</div>
            </div>
          </div>
        </template>
      </Paginator>
    </div>

    <Transition>
      <SelectionOperation v-if="multipleOperation && selectionMode === 'multiple' && selectionData?.length > 0" v-model:selection="selectionData" :total="tableList.length"
        :operation="_getOperation(selectionData)" @batch-operation="batchOperation">
        <template #custom-operation>
          <slot name="multiple-operation" :selection="selectionData" :clear-selection="_clearSelection" />
        </template>
      </SelectionOperation>
    </Transition>
  </div>
</template>

<style lang="scss" scoped>
.rx-header {
  display: flex;
  padding: var(--spacing-xl, 12px) var(--spacing-4xl, 24px);
  justify-content: space-between;
  align-items: center;
  align-self: stretch;
  border-bottom: 0.5px solid var(--Colors-Border-border-subtle, #e4e8eb);
}

:deep(.p-checkbox-box) {
  width: 16px;
  height: 16px;
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
    color: var(--Component-Colors-Buttons-Secondary-text, #171c1f);
    font-family: Inter;
    font-size: var(--Font-Size-text-sm, 12px);
    font-weight: 500;
    line-height: var(--Line-Height-text-xs, 16px);
  }

  :deep(.p-paginator-page-selected) {
    background: none;
    color: var(--Component-Colors-Buttons-Ghost-text, #12a3fc);
    border-radius: var(--radius-sm, 4px);
    border: 0.5px solid var(--Component-Colors-Buttons-Tertiary-border, #12a3fc);
    background: var(--Component-Colors-Buttons-Ghost-bg, #fff);
    box-shadow:
      0px 4px 4px -1px rgba(0, 0, 0, 0.02),
      0px 1px 1px 0px rgba(0, 0, 0, 0.06);
  }

  :deep(.p-inputtext) {
    padding: 4px 4px 4px 6px;
    width: 60px;
    border-radius: var(--radius-sm, 4px);
    border: 0.5px solid var(--Component-Colors-TextInput-border-border, #c7cdd1);
    background: var(--Component-Colors-TextInput-bg-bg, #fff);
    box-shadow: 0px 1px 2px 0px rgba(16, 24, 40, 0.05);

    color: var(--Component-Colors-TextInput-text-text-placeholder, #7c8387);
    font-family: Inter;
    font-size: 12px;
    line-height: var(--Line-Height-text-xs, 16px);
  }

  :deep(.p-select) {
    padding: 4px 4px 4px 6px;
    gap: 6px;
    width: 60px;
    border-radius: var(--radius-sm, 4px);
    border: 0.5px solid var(--Component-Colors-TextInput-border-border, #c7cdd1);
    background: var(--Component-Colors-TextInput-bg-bg, #fff);
    box-shadow: 0px 1px 2px 0px rgba(16, 24, 40, 0.05);

    .p-select-label {
      padding: 0;
    }

    .p-select-dropdown {
      width: auto;
    }
  }

  &-jump {
    display: flex;
    gap: var(--spacing-lg, 8px);
    color: var(--Colors-Text-text-secondary, #575d61);
    font-family: Inter;
    font-size: 12px;
    line-height: var(--Line-Height-text-xs, 16px);
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

<style lang="scss" module="Css_Module">
.columntitle {
  color: #000;
  font-family: Inter;
  font-size: 12px;
  line-height: 16px;
}

.headercell {
  padding: var(--spacing-lg, 8px) var(--spacing-md, 6px) !important;
  background: var(--Colors-Background-bg-page, #fafbfc) !important;
  border-color: var(--Colors-Border-border-subtle, #e4e8eb) !important;

  &:first-of-type {
    padding-left: var(--spacing-4xl, 24px) !important;
  }
}

.bodyrow {
  &[data-p-selected='true'] {
    background: var(--Colors-Background-bg-secondary, #e8f5fc);

    .bodycell {
      border-color: var(--Color-blue-200, #7eccfc);
    }
  }

  &:not([data-p-selected='true']):hover {
    background: var(--Colors-Background-bg-body-hover, #f0f3f5);

    .bodycell {
      border-color: var(--Colors-Border-border-container, #c7cdd1);
    }
  }

  .bodycell {
    padding: var(--spacing-2xl, 16px) var(--spacing-md, 6px) !important;
    border-color: var(--Colors-Border-border-subtle, #e4e8eb);
    border-bottom-width: 0.5px;

    &:first-of-type {
      padding-left: var(--spacing-4xl, 24px) !important;
    }
  }
}
</style>
