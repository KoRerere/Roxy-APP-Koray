<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { useConfirm } from 'primevue/useconfirm'
import type { Operation } from '/@/utils'
import PhoneName from './phone-name.vue'
import PhoneTags from './phone-tags.vue'
import PhoneListEmpty from './phone-list-empty.vue'
import PhoneProxyDialog from './phone-proxy-dialog.vue'
import androidHead from '/@/assets/images/cloud-phone/android-head.png'
import AdvancedSearch from '/@/views/browser/list/profiles/components/advanced-search.vue'
import CustomEmpty from '/@/components/custom-empty.vue'
import { RxSvgIcon } from '/@/components/rx-icon'
import RxButton from '/@/components/rx-button'
import RxDivider from '/@/components/rx-divider.vue'
import RxInputSelect from '/@/components/ry-form/rx-input-select.vue'
import RxTag from '/@/components/rx-tag.vue'
import RyTable from '/@/components/ry-table'
import TableDisplay from '/@/components/ry-table/table-display.vue'
import TableReload from '/@/components/ry-table/table-reload.vue'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { copyText } from '/@/utils'
import { useCloudPhones } from '../useCloudPhones'
import type { CloudPhoneItem } from '../useCloudPhones'

defineOptions({ inheritAttrs: false })

const emit = defineEmits<{ (e: 'create'): void }>()

const { t: $t } = useI18n()

const { phones, filteredPhones, searchQuery, selectedGroup, groups, toggleStatus, batchSetStatus, batchMoveToTrash, updatePhoneTags } = useCloudPhones()

const [showToast] = useResponseToast()
const confirm = useConfirm()
const showNotes = ref(false)
const proxyVisible = ref(false)
const proxyPhoneIds = ref<string[]>([])
let finishProxy: ((saved: boolean) => void) | undefined

const tableRef = useTemplateRef<any>('table')

const columns = ref<any[]>([
  {
    title: $t('编号'),
    key: 'no',
    disabledToggle: true,
    slot: 'no',
    sortable: true,
    style: { width: '160px' },
  },
  {
    title: $t('云手机名称'),
    key: 'name',
    disabledToggle: true,
    slot: 'name',
    style: { width: '200px' },
  },
  {
    title: $t('设备信息'),
    key: 'device',
    slot: 'device',
    style: { width: '240px' },
  },
  {
    title: $t('环境 ID'),
    key: 'id',
    slot: 'envId',
    style: { width: '200px' },
  },
  {
    title: $t('备注'),
    key: 'notes',
    slot: 'notes',
    headerSlot: 'notesHeader',
    style: { width: '120px' },
  },
  {
    title: $t('分组'),
    key: 'group',
    slot: 'group',
    style: { width: '160px' },
  },
  {
    title: $t('标签'),
    key: 'tags',
    slot: 'tags',
    style: { width: '120px' },
  },
  {
    title: $t('创建时间'),
    key: 'createdTime',
    slot: 'createdTime',
    sortable: true,
    style: { width: '200px' },
  },
  {
    title: $t('最后打开'),
    key: 'lastOpened',
    slot: 'lastOpened',
    sortable: true,
    style: { width: '200px' },
  },
].map(column => ({ ...column, _visible: true })))

const tableMinWidth = computed(() => columns.value.reduce((width, column) => {
  return width + (column._visible ? Number.parseInt(column.style.width, 10) : 0)
}, 64 + 154))

const groupOptions = computed(() => {
  return groups.value.map(item => ({
    label: item === 'all' ? $t('全部') : item === '未分组' ? $t('未分组') : item,
    value: item,
  }))
})

/** 云手机列表目前为本地数据，这里按分页/排序规则在内存中切片返回 */
async function tableRequest(params: Record<string, any> = {}) {
  const { page_index = 1, page_size = 10, orderName, orderType } = params
  const list = [...filteredPhones.value]

  if (orderName) {
    list.sort((a: any, b: any) => {
      const left = a[orderName]
      const right = b[orderName]
      const result = typeof left === 'number' && typeof right === 'number'
        ? left - right
        : String(left ?? '').localeCompare(String(right ?? ''))
      return orderType === 'desc' ? -result : result
    })
  }

  const size = Number(page_size)
  const start = (Number(page_index) - 1) * size
  return {
    code: 0,
    data: {
      rows: list.slice(start, start + size),
      total: list.length,
    },
  }
}

function refreshTable() {
  return tableRef.value?.refresh()
}

function onSearch(payload: Record<string, any>) {
  searchQuery.value = payload?.value ?? ''
  return refreshTable()
}

function onClearSearch() {
  searchQuery.value = ''
  return refreshTable()
}

function handleCopy(text: string) {
  copyText(text)
  showToast({
    severity: 'success',
    summary: $t('复制成功'),
  })
}

function onToggleStatus(row: CloudPhoneItem) {
  try {
    toggleStatus(row)
  }
  catch {
    showToast(-1, $t('保存失败，请检查本地存储空间后重试'))
  }
}

function onTagsChange(row: CloudPhoneItem, tags: string[]) {
  try {
    updatePhoneTags(row.id, tags)
  }
  catch {
    showToast(-1, $t('保存失败，请检查本地存储空间后重试'))
  }
}

function onTestAllProxy() {
  showToast({
    severity: 'info',
    summary: $t('开始检测代理网络...'),
  })
}

function getOperation(row: CloudPhoneItem | CloudPhoneItem[]): Operation[] {
  const bulkActions: Operation[] = [
    { name: 'open', label: $t('打开'), icon: 'base/rx_ic_play', multiple: true, multipleProps: { name: 'G1', showLabel: true, iconProps: { color: 'var(--pattern-actionbar-icon-open)' } } },
    { name: 'close', label: $t('关闭'), icon: 'base/rx_ic_shut_down', multiple: true, multipleProps: { name: 'G2', showLabel: true } },
    { name: 'restart', label: $t('重启'), icon: 'base/rx_ic_refresh', multiple: true, multipleProps: { name: 'G3', showLabel: true } },
    { name: 'proxy', label: $t('更换代理'), icon: 'base/rx_ic_earth', multiple: true, multipleProps: { name: 'G4', showLabel: true } },
    { name: 'trash', label: $t('删除'), icon: 'base/rx_ic_bin_1', multiple: true, multipleProps: { name: 'G5', showLabel: true } },
  ]
  if (Array.isArray(row)) {
    return bulkActions
  }
  return [
    { name: 'testProxy', label: $t('测试代理 IP'), icon: 'base/rx_ic_speed_test', quick: true, tooltip: $t('测试代理 IP') },
    { name: 'edit', label: $t('编辑'), icon: 'base/rx_ic_edit' },
    { name: 'proxy', label: $t('修改代理'), icon: 'base/rx_ic_earth' },
    { name: 'adb', label: $t('启用 ADB'), icon: 'base/rx_ic_doc_code' },
    { name: 'root', label: $t('启用 ROOT'), icon: 'base/rx_ic_lock' },
    { name: 'clone', label: $t('克隆'), icon: 'base/rx_ic_copy' },
    { name: 'install', label: $t('一键装机'), icon: 'base/rx_ic_download' },
    { separator: true },
    { name: 'trash', label: $t('移至回收站'), icon: 'base/rx_ic_bin_1' },
  ]
}

function confirmDelete(count: number) {
  return new Promise<boolean>((resolve) => {
    confirm.require({
      group: 'deleteConfirmDialog',
      header: $t('删除云手机'),
      message: $t('确定将所选的 {count} 台云手机移至回收站吗？您可以稍后恢复。', { count }),
      rejectProps: { label: $t('取消'), severity: 'secondary', outlined: true },
      acceptProps: { label: $t('删除'), severity: 'danger' },
      accept: () => resolve(true),
      reject: () => resolve(false),
      onHide: () => resolve(false),
    })
  })
}

function openProxyDialog(ids: string[]) {
  proxyPhoneIds.value = ids
  proxyVisible.value = true
  return new Promise<boolean>((resolve) => {
    finishProxy = resolve
  })
}

function onProxySaved(count: number) {
  showToast(0, $t('已为 {count} 台云手机更新代理', { count }))
  finishProxy?.(true)
  finishProxy = undefined
}

watch(proxyVisible, (visible) => {
  if (!visible) {
    finishProxy?.(false)
    finishProxy = undefined
  }
})
onBeforeUnmount(() => {
  finishProxy?.(false)
})

async function onOperation(item: Operation, row: CloudPhoneItem | CloudPhoneItem[]) {
  const ids = new Set((Array.isArray(row) ? row : [row]).map(phone => phone.id))
  const targets = phones.value.filter(phone => ids.has(phone.id))
  if (!targets.length) {
    return
  }

  const targetIds = targets.map(phone => phone.id)
  try {
    if (item.name === 'trash') {
      if (!await confirmDelete(targetIds.length)) {
        throw new Error('Cloud phone action cancelled')
      }
      const count = batchMoveToTrash(targetIds)
      showToast(0, $t('已将 {count} 台云手机移至回收站', { count }))
    }
    else if (item.name === 'proxy') {
      if (!await openProxyDialog(targetIds)) {
        throw new Error('Cloud phone action cancelled')
      }
    }
    else if (item.name === 'open' || item.name === 'close' || item.name === 'restart') {
      const count = batchSetStatus(targetIds, item.name)
      const messages = {
        open: $t('已打开 {count} 台云手机', { count }),
        close: $t('已关闭 {count} 台云手机', { count }),
        restart: $t('已重启 {count} 台云手机', { count }),
      }
      showToast(0, count ? messages[item.name] : $t('所选云手机已处于目标状态'))
    }
    else {
      showToast({ severity: 'info', summary: item.label as string })
    }
  }
  catch (error) {
    if (!(error instanceof Error && error.message === 'Cloud phone action cancelled')) {
      showToast(-1, $t('保存失败，请检查本地存储空间后重试'))
    }
    throw error
  }
}

/** 代理地区形如 HK/HongKong，取国家短码映射国旗图标 */
function flagIcon(location?: string) {
  const code = (location || '').split('/')[0]?.trim().toUpperCase()
  return code ? `country-code/${code}` : 'base/rx_ic_earth'
}

function systemVersion(system?: string) {
  return (system || '').replace(/[^\d.]/g, '') || '-'
}

function splitDateTime(value?: string) {
  const [date = '-', time = ''] = (value || '').split(' ')
  return { date, time }
}

watch([phones, selectedGroup], refreshTable, { deep: true })

// 完全没有云手机时：隐藏表头，置灰列表操作，顶部创建按钮降为次级，突出空状态里的主操作
const isEmptyList = computed(() => !phones.value.length)
</script>

<template>
  <RyTable
    ref="table" v-model:columns="columns" v-bind="$attrs" cache-key="cloud-phone-list" :table-request="tableRequest" :table-operation="getOperation" :operation-handler="onOperation"
    selection-mode="multiple" class="cloud-phone-table min-w-0" :class="{ 'cloud-phone-table--empty': !filteredPhones.length, 'cloud-phone-table--no-data': isEmptyList }" :style="{ '--cloud-phone-table-width': `${tableMinWidth}px` }"
  >
    <template #table-header>
      <div class="flex min-w-0 flex-1 flex-wrap items-center gap-3">
        <div class="flex items-center gap-1.5">
          <AdvancedSearch :search="onSearch" :clear="onClearSearch" />
          <RxInputSelect
            v-model="selectedGroup" class="!w-30" name="cloud-phone-group" size="xxs" :options="groupOptions" option-label="label" option-value="value"
            :filter="false" :placeholder="$t('选择分组')"
          />
        </div>
        <RxDivider vertical line-only line-color="var(--colors-border-border-subtle)" class="!h-4 !w-px shrink-0" />
        <RxButton size="xxs" outlined severity="secondary" icon="base/rx_ic_filter" :label="$t('添加筛选')" :disabled="isEmptyList" />
      </div>
      <div class="flex shrink-0 items-center gap-3">
        <RxButton
          size="xxs" icon="base/rx_ic_plus" :label="$t('创建云手机')" :outlined="isEmptyList" :severity="isEmptyList ? 'secondary' : undefined"
          @click="emit('create')"
        />
        <RxButton size="xxs" outlined severity="secondary" icon="base/rx_ic_speed_test" :label="$t('测试全部代理 IP')" :disabled="isEmptyList" @click="onTestAllProxy" />
        <RxDivider vertical line-only line-color="var(--colors-border-divider)" class="!h-4 shrink-0" />
        <div class="flex items-center gap-2">
          <TableReload :loading="false" @click="refreshTable" />
          <RxButton v-tooltip.top="{ value: $t('标签管理') }" size="xxs" outlined severity="secondary" icon="base/rx_ic_tag" :disabled="isEmptyList" />
          <TableDisplay v-if="!isEmptyList" v-model:columns="columns" />
        </div>
      </div>
    </template>

    <template #table-empty>
      <PhoneListEmpty v-if="!phones.length" @create="emit('create')" />
      <CustomEmpty v-else :title="$t('抱歉，没有找到匹配结果。')" class="py-12" />
    </template>

    <!-- 编号：序号 + 代理地区国旗 + 安卓版本 -->
    <template #no="{ data }">
      <div class="flex items-center gap-3">
        <span class="min-w-12 shrink-0 whitespace-nowrap text-left font-[JetBrains_Mono] font-500 tt-primary">{{ `CPN-${String(data.no).padStart(2, '0')}` }}</span>
        <div class="flex shrink-0 items-center gap-1">
          <span class="cloud-phone-table__flag" :title="data.proxyLocation">
            <RxSvgIcon :name="flagIcon(data.proxyLocation) as any" fallback="base/rx_ic_earth" size="18" />
          </span>
          <RxDivider line-only line-style="dashed" line-color="var(--colors-border-divider-dashed)" class="!w-5" />
          <span class="relative h-7 w-4.5 shrink-0 overflow-hidden rounded-0.75 border-1 border-solid border-[var(--colors-text-text-primary)] bg-[var(--colors-background-bg-page)]" :title="data.system">
            <span class="absolute left-1/2 top-0.5 h-0.5 w-0.5 rounded-full bg-[var(--colors-text-text-primary)] -translate-x-1/2" />
            <span class="absolute inset-x-0 top-1.5 text-center text-2.5 font-500 leading-3 tt-primary">{{ systemVersion(data.system) }}</span>
            <img :src="androidHead" alt="" class="absolute bottom-0 left-1/2 h-2.75 w-4.5 max-w-none -translate-x-1/2">
          </span>
        </div>
      </div>
    </template>

    <template #name="{ data }">
      <PhoneName :data="data" @refresh="refreshTable" />
    </template>

    <!-- 设备信息：代理地区 + 系统版本 -->
    <template #device="{ data }">
      <div class="flex min-w-0 flex-col gap-1 leading-4">
        <div class="flex min-w-0 items-center gap-1.5">
          <RxSvgIcon class="shrink-0" :name="flagIcon(data.proxyLocation) as any" fallback="base/rx_ic_earth" size="16" aria-hidden="true" />
          <span class="min-w-0 truncate" :title="`${data.proxyLocation} (${data.proxyIp})`">
            {{ data.proxyLocation }} ({{ data.proxyIp }})
          </span>
        </div>
        <span class="flex items-center gap-1.5 font-normal tt-tertiary">
          {{ data.system }}
          <RxSvgIcon v-if="data.unlimited" name="base/rx_ic_infinity" size="14" color="var(--colors-icon-icon-brand)" />
        </span>
      </div>
    </template>

    <template #envId="{ data }">
      <span v-tooltip.top="{ value: $t('复制') }" class="block truncate cursor-pointer" :title="data.id" @click.stop="handleCopy(data.id)">{{ data.id }}</span>
    </template>

    <template #notesHeader="{ column, class: headerClass }">
      <div class="flex items-center gap-1.5">
        <span :class="headerClass">{{ column.title }}</span>
        <RxButton
          v-tooltip.top="{ value: showNotes ? $t('收起') : $t('展开') }" text severity="secondary" size="xxs"
          :icon="showNotes ? 'base/rx_ic_hidden' : 'base/rx_ic_eye'" :aria-label="showNotes ? $t('收起') : $t('展开')"
          class="!h-4 !w-4 !min-w-0 !p-0" @click.stop="showNotes = !showNotes"
        />
      </div>
    </template>

    <template #notes="{ data }">
      <div class="flex items-center gap-1">
        <RxButton v-if="data.notes" v-tooltip.top="{ value: data.notes }" class="shrink-0" text severity="secondary" size="xxs">
          <template #icon>
            <RxSvgIcon name="base/rx_ic_doc_fill" color="var(--colors-icon-icon-brand)" />
          </template>
        </RxButton>
        <RxButton v-else text severity="secondary" size="xxs" icon="base/rx_ic_doc_add" />
        <span v-if="showNotes" class="min-w-0 truncate" :title="data.notes">{{ data.notes }}</span>
      </div>
    </template>

    <template #group="{ data }">
      <RxTag icon="base/rx_ic_stack" :label="data.group === '未分组' ? $t('未分组') : data.group" :tooltip="data.group === '未分组' ? $t('未分组') : data.group" class="max-w-full [&_.rx-tag-label]:truncate" />
    </template>

    <template #tags="{ data }">
      <PhoneTags :model-value="data.tags" @update:model-value="onTagsChange(data, $event)" />
    </template>

    <template #createdTime="{ data }">
      <div class="flex min-w-0 flex-col gap-1 leading-4">
        <span>{{ splitDateTime(data.createdTime).date }}</span>
        <span class="font-normal tt-tertiary">{{ splitDateTime(data.createdTime).time }}</span>
      </div>
    </template>

    <template #lastOpened="{ data }">
      <div class="flex min-w-0 flex-col gap-1 leading-4">
        <span class="truncate" :title="data.lastOpened">{{ data.lastOpened }}</span>
        <span class="truncate font-normal tt-tertiary" :title="data.operator">{{ data.operator }}</span>
      </div>
    </template>

    <template #actions-extra="{ data }">
      <RxButton
        v-if="data.status === 'running'" size="xxs" severity="danger" outlined icon="base/rx_ic_browser_stop" :label="$t('停止')"
        class="mr-2 !min-w-[61px] shrink-0"
        @click.stop="onToggleStatus(data)"
      />
      <RxButton v-else size="xxs" icon="base/rx_ic_shut_down" :label="$t('启动')" class="mr-2 !min-w-[61px] shrink-0" @click.stop="onToggleStatus(data)" />
    </template>
  </RyTable>
  <PhoneProxyDialog v-if="proxyVisible" v-model:visible="proxyVisible" :phone-ids="proxyPhoneIds" @saved="onProxySaved" />
</template>

<style lang="scss" scoped>
.cloud-phone-table {
  :deep(.rx-header) {
    align-items: center;
    flex-wrap: wrap;
    gap: 12px;
  }

  :deep(.p-datatable-table) {
    min-width: var(--cloud-phone-table-width);
    table-layout: fixed;
  }

  :deep(.p-datatable-thead th:first-child),
  :deep(.p-datatable-tbody td:first-child) {
    width: 64px !important;
    padding-right: 24px;
  }

  :deep(.p-datatable-thead th:last-child),
  :deep(.p-datatable-tbody td:last-child) {
    width: 154px !important;
  }

  :deep(.p-datatable-thead th:nth-child(3)) {
    width: auto !important;
  }

  :deep(.p-datatable-tbody > tr > td) {
    height: 64px;
    line-height: 16px;
  }

  // 完全没有云手机时隐藏表头（含全选框）
  &--no-data :deep(.p-datatable-thead) {
    display: none;
  }

  &--empty {
    :deep(.p-datatable-table) {
      min-width: 100%;
    }

    :deep(.p-datatable-thead th) {
      width: auto !important;
    }

    :deep(.p-datatable-tbody > .p-datatable-empty-message > td) {
      width: auto !important;
      height: auto;
      padding: 0;
      vertical-align: top;
    }
  }

  &__flag {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    flex-shrink: 0;
    border: 0.5px solid var(--colors-border-border-base);
    border-radius: 4px;
    background: var(--colors-background-bg-action);
    box-shadow:
      0 4px 2px rgba(0, 0, 0, 0.02),
      0 1px 0.5px rgba(0, 0, 0, 0.06);
  }
}
</style>
