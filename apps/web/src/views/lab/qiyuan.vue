<script setup lang="ts">
import Table from './components/table/table.vue'
import type { ActionsItem, LabTableActionScope, LabTableColumn } from './components/table/type'
import { sleep } from '/@/utils'
import { useResponseToast } from '/@/hooks/useResponseToast'

const [showToast] = useResponseToast()
const tableRef = useTemplateRef<InstanceType<typeof Table>>('labTable')
const tableKey = ref(0)
const requestCount = ref(0)
const allowGated = ref(true)

const selection = ref<any[]>([])
const showHeader = ref(true)
const showReload = ref(true)
const showPaginator = ref(true)
const showSelectionBar = ref(true)
const actionsMode = ref<'full' | 'quick' | 'hidden'>('full')
const loadingMode = ref<'mask' | 'skeleton'>('mask')
const forceEmpty = ref(false)
const customHeader = ref(false)

const chrome = computed(() => ({
  header: showHeader.value,
  reload: showReload.value,
  paginator: showPaginator.value,
  selectionBar: showSelectionBar.value,
  actions: actionsMode.value === 'full' ? true as const : actionsMode.value === 'quick' ? 'quick' as const : false as const,
}))

const columns: LabTableColumn[] = [
  {
    header: $t('名称'),
    field: 'name',
    props: { sortable: true },
    skeleton: { width: '8rem', height: '1rem' },
  },
  {
    header: $t('分类'),
    field: 'category',
    props: { sortable: true },
    skeleton: { width: '5rem', height: '1rem' },
    getText: row => row.category === 'window' ? $t('窗口') : $t('代理 IP'),
  },
  {
    header: $t('数量'),
    field: 'quantity',
    props: { sortable: true },
    skeleton: { width: '3rem', height: '1rem' },
  },
  {
    header: $t('状态'),
    field: 'status',
    slot: 'status',
    skeleton: { width: '4rem', height: '1rem' },
  },
]

const allRows = Array.from({ length: 40 }, (_, index) => {
  const id = index + 1
  return {
    id: String(id),
    name: `Profile ${id}`,
    category: id % 2 === 0 ? 'window' : 'proxy',
    quantity: id * 2,
    status: id % 7 === 0 ? 'locked' : 'ready',
  }
})

function tableFilters() {
  return [
    {
      type: 'select',
      name: 'category',
      props: {
        placeholder: $t('全部分类'),
        options: [
          { label: $t('窗口'), value: 'window' },
          { label: $t('代理 IP'), value: 'proxy' },
        ],
      },
    },
  ]
}

function tableSort() {
  return {
    data: { sortField: 'quantity', sortOrder: 1 as const },
  }
}

/** 本地分页，用来确认请求结果不会被 dataList 默认值挡住 */
async function tableRequest(params: Record<string, any>) {
  requestCount.value += 1
  await sleep(400)
  if (forceEmpty.value) {
    return { data: { rows: [], total: 0 } }
  }

  let list = allRows.filter(row => !params.category || row.category === params.category)
  if (params.orderName) {
    const direction = params.orderType === 'desc' ? -1 : 1
    list = [...list].sort((left, right) => {
      const leftValue = left[params.orderName as keyof typeof left]
      const rightValue = right[params.orderName as keyof typeof right]
      if (leftValue === rightValue) {
        return 0
      }
      return leftValue > rightValue ? direction : -direction
    })
  }
  const pageSize = Number(params.page_size) || 10
  const pageIndex = Number(params.page_index) || 1
  const start = (pageIndex - 1) * pageSize
  return {
    data: {
      rows: list.slice(start, start + pageSize),
      total: list.length,
    },
  }
}

function isRowDisabled(row: { status?: string }) {
  return row?.status === 'locked'
}

function namesOf(data: any) {
  return ([] as any[]).concat(data ?? []).map(item => item?.name).filter(Boolean).join(', ')
}

/** 行菜单和批量菜单共用一份操作：快捷区带文案，更多菜单含全量批量项和子菜单 */
function tableModel(scope: LabTableActionScope): ActionsItem[] {
  const data = scope.rows ?? scope.row
  return [
    {
      key: 'open',
      label: $t('打开'),
      icon: 'base/rx_ic_at',
      quick: true,
      multiple: { name: 'G1', showLabel: true },
      command: async () => {
        await sleep(2000)
        showToast(0, $t('已打开 {name}', { name: namesOf(data) }))
      },
    },
    {
      key: 'edit',
      label: $t('编辑'),
      icon: 'base/rx_ic_shut_down',
      quick: true,
      multiple: { name: 'G2', showLabel: true },
      command: () => showToast(0, $t('已编辑 {name}', { name: namesOf(data) })),
    },
    {
      key: 'gated',
      label: $t('受控操作'),
      icon: 'base/rx_ic_2fa',
      quick: true,
      power: () => allowGated.value,
      command: () => showToast(0, $t('已标记 {count} 行', { count: ([] as any[]).concat(data ?? []).length || 1 })),
    },
    {
      key: 'secret',
      label: $t('无权限'),
      icon: 'base/rx_ic_brush',
      quick: true,
      power: false,
      command: () => showToast(0, $t('无权限')),
    },
    {
      key: 'copy',
      label: $t('复制'),
      icon: 'base/rx_ic_download',
      multiple: { name: 'G3', showLabel: true },
      command: () => showToast(0, $t('已复制 {name}', { name: namesOf(data) })),
    },
    {
      key: 'mark',
      label: $t('批量标记'),
      icon: 'base/rx_ic_2fa',
      onlyMultiple: true,
      multiple: { name: 'G4', showLabel: true },
      command: ({ data: rows }) => {
        showToast(0, $t('已标记 {count} 行', { count: ([] as any[]).concat(rows ?? data ?? []).length }))
      },
    },
    {
      separator: true,
      multiple: true,
    },
    {
      key: 'moreGroup',
      label: $t('更多操作'),
      icon: 'base/rx_ic_browser',
      multiple: true,
      items: [
        {
          key: 'view',
          label: $t('查看'),
          icon: 'base/rx_ic_browser',
          multiple: false,
          command: () => showToast(0, $t('已打开 {name}', { name: namesOf(data) })),
        },
        {
          key: 'export',
          label: $t('导出窗口'),
          icon: 'base/rx_ic_export',
          command: () => showToast(0, $t('已复制 {name}', { name: namesOf(data) })),
        },
      ],
    },
    {
      key: 'clear',
      label: $t('清除缓存'),
      icon: 'base/rx_ic_brush',
      multiple: true,
      command: () => showToast(0, $t('已标记 {count} 行', { count: ([] as any[]).concat(data ?? []).length })),
    },
    {
      key: 'robot',
      label: $t('Cookie 机器人'),
      icon: 'base/rx_ic_cookie_bot',
      suffixIcon: 'base/fire',
      multiple: true,
      command: () => showToast(0, $t('已标记 {count} 行', { count: ([] as any[]).concat(data ?? []).length })),
    },
  ]
}

watch([forceEmpty, loadingMode], () => {
  tableRef.value?.refresh()
})
</script>

<template>
  <div class="h-full flex flex-col">
    <div class="flex flex-wrap items-center gap-x-4 gap-y-2 px-6 py-2 text-12px">
      <label class="flex items-center gap-1">
        <input v-model="showHeader" type="checkbox">
        {{ $t('表头') }}
      </label>
      <label class="flex items-center gap-1">
        <input v-model="showReload" type="checkbox">
        {{ $t('刷新') }}
      </label>
      <label class="flex items-center gap-1">
        <input v-model="showPaginator" type="checkbox">
        {{ $t('分页') }}
      </label>
      <label class="flex items-center gap-1">
        <input v-model="showSelectionBar" type="checkbox">
        {{ $t('批量条') }}
      </label>
      <label class="flex items-center gap-1">
        <input v-model="forceEmpty" type="checkbox">
        {{ $t('空数据') }}
      </label>
      <label class="flex items-center gap-1">
        <input v-model="customHeader" type="checkbox">
        {{ $t('自定义表头') }}
      </label>
      <label class="flex items-center gap-1">
        {{ $t('操作列') }}
        <select v-model="actionsMode" class="border border-solid border-[var(--colors-border-border-base)] rounded px-1 py-0.5 bg-transparent">
          <option value="full">{{ $t('完整') }}</option>
          <option value="quick">{{ $t('仅快捷') }}</option>
          <option value="hidden">{{ $t('隐藏') }}</option>
        </select>
      </label>
      <label class="flex items-center gap-1">
        {{ $t('加载方式') }}
        <select v-model="loadingMode" class="border border-solid border-[var(--colors-border-border-base)] rounded px-1 py-0.5 bg-transparent">
          <option value="mask">{{ $t('遮罩') }}</option>
          <option value="skeleton">{{ $t('骨架屏') }}</option>
        </select>
      </label>
      <label class="flex items-center gap-1">
        <input v-model="allowGated" type="checkbox">
        {{ $t('允许受控操作') }}
      </label>
      <button type="button" class="border border-solid border-[var(--colors-border-border-base)] rounded px-1 py-0.5" @click="tableKey += 1">
        {{ $t('重新挂载') }}
      </button>
      <span>{{ $t('请求 {count} 次', { count: requestCount }) }}</span>
      <span>{{ $t('已选 {count} 行', { count: selection.length }) }}</span>
    </div>

    <div class="flex-1 overflow-hidden">
      <Table :key="tableKey" ref="labTable" v-model:selection="selection" class="h-full" data-key="id" cache-key="qiyuan-lab" display-key="qiyuan-lab-columns" remember="qiyuan-lab" selection-mode="multiple" :columns="columns"
             :chrome="chrome" :loading="loadingMode" :model="tableModel" :table-filters="tableFilters" :table-sort="tableSort" :table-request="tableRequest" :is-row-disabled="isRowDisabled"
             :page-size="10"
      >
        <template v-if="customHeader" #header>
          <div class="flex-1 text-13px">
            {{ $t('自定义表头') }}
          </div>
        </template>
        <template #filter-after>
          <div class="basis-full flex flex-wrap gap-2 text-12px">
            <span>{{ $t('实验表格') }}</span>
            <span>{{ $t('打开') }}</span>
            <span>{{ $t('编辑') }}</span>
            <span>{{ $t('复制') }}</span>
          </div>
        </template>
        <template #toolbar>
          <span class="text-12px opacity-70">{{ $t('实验表格') }}</span>
        </template>
        <template #empty>
          <div class="py-8 text-13px">
            {{ $t('没有匹配的数据') }}
          </div>
        </template>
        <template #column-before="{ ptProps }">
          <Column header="#" :pt="ptProps">
            <template #body="{ index }">
              {{ index + 1 }}
            </template>
          </Column>
        </template>
        <template #status="{ data }">
          <span>{{ data.status === 'locked' ? $t('已锁定') : $t('可用') }}</span>
        </template>
        <template #selection-actions="{ selection: rows, clear }">
          <RxButton text severity="secondary" size="xxs" :label="$t('自定义批量')" :on-click="() => { showToast(0, $t('已标记 {count} 行', { count: rows.length })); clear() }" />
        </template>
      </Table>
    </div>
  </div>
</template>
