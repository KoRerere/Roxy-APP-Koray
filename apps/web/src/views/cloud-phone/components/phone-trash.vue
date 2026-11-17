<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import CustomEmpty from '/@/components/custom-empty.vue'
import CustomNewEmpty from '/@/components/custom-new-empty.vue'
import RxButton from '/@/components/rx-button'
import RxDivider from '/@/components/rx-divider.vue'
import RxInputSelect from '/@/components/ry-form/rx-input-select.vue'
import RyTable from '/@/components/ry-table'
import TableReload from '/@/components/ry-table/table-reload.vue'
import AdvancedSearch from '/@/views/browser/list/profiles/components/advanced-search.vue'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { useCloudPhones } from '../useCloudPhones'
import type { Operation } from '/@/utils'
import type { CloudPhoneItem } from '../useCloudPhones'

const { t: $t } = useI18n()

const { trash, restoreFromTrash, deletePermanently } = useCloudPhones()

const [showToast] = useResponseToast()

// 顶部筛选：搜索 + 分组（仅作用于回收站，不影响云手机列表的筛选状态）
const searchQuery = ref('')
const selectedGroup = ref('all')
const refreshing = ref(false)

const groupOptions = computed(() => {
  const groups = ['all', ...new Set(trash.value.map(item => item.group))]
  return groups.map(item => ({
    label: item === 'all' ? $t('全部') : item === '未分组' ? $t('未分组') : item,
    value: item,
  }))
})

const filteredTrash = computed(() => {
  const q = searchQuery.value.toLowerCase().trim()
  return trash.value.filter((item) => {
    if (selectedGroup.value !== 'all' && item.group !== selectedGroup.value) {
      return false
    }
    if (!q) {
      return true
    }
    return item.name.toLowerCase().includes(q) || item.id.toLowerCase().includes(q)
  })
})

function onSearch(payload: Record<string, any>) {
  searchQuery.value = payload?.value ?? ''
}

function onClearSearch() {
  searchQuery.value = ''
}

/** 回收站目前为本地数据，刷新只给出加载反馈 */
function onRefresh() {
  refreshing.value = true
  setTimeout(() => {
    refreshing.value = false
  }, 300)
}

const columns = ref<any[]>([
  {
    title: $t('云手机名称'),
    key: 'name',
    disabledToggle: true,
    slot: 'name',
    style: { width: '220px', minWidth: '160px' },
  },
  {
    title: $t('环境 ID'),
    key: 'id',
    slot: 'envId',
    style: { width: '220px', minWidth: '180px' },
  },
  {
    title: $t('系统版本'),
    key: 'system',
    slot: 'system',
    style: { width: '160px', minWidth: '120px' },
  },
])

// 与窗口回收站保持一致：操作列使用图标 + tooltip
const operation: Operation[] = [
  { name: 'restore', label: $t('恢复'), tooltip: $t('恢复'), icon: 'base/rx_ic_refresh', quick: true },
  { name: 'delete', label: $t('永久删除'), tooltip: $t('永久删除'), icon: 'base/rx_ic_bin_1', iconClass: 'text-red', quick: true },
]

function onOperation(item: Operation, row: CloudPhoneItem) {
  if (item.name === 'restore') {
    onRestore(row)
  }
  else if (item.name === 'delete') {
    onDelete(row)
  }
}

function onRestore(row: CloudPhoneItem) {
  restoreFromTrash(row)
  showToast({ severity: 'success', summary: $t('恢复') })
}

function onDelete(row: CloudPhoneItem) {
  deletePermanently(row)
  showToast({ severity: 'info', summary: $t('永久删除') })
}
</script>

<template>
  <RyTable v-model:columns="columns" :data-list="filteredTrash" :immediate="false" :paginator="false" :show-actions-menu="false" :operation="operation" :operation-handler="onOperation"
           class="cloud-phone-trash"
  >
    <template #table-header>
      <div class="flex min-w-0 flex-1 flex-wrap items-center gap-3">
        <div class="flex items-center gap-1.5">
          <AdvancedSearch :search="onSearch" :clear="onClearSearch" />
          <RxInputSelect
            v-model="selectedGroup" class="!w-45" name="cloud-phone-trash-group" size="xxs" :options="groupOptions" option-label="label" option-value="value"
            :filter="false" :placeholder="$t('选择分组')"
          />
        </div>
        <RxDivider vertical line-only line-color="var(--colors-border-border-subtle)" class="!h-4 !w-px shrink-0" />
        <RxButton size="xxs" outlined severity="secondary" icon="base/rx_ic_filter" :label="$t('添加筛选')" />
      </div>
      <div class="flex shrink-0 items-center">
        <TableReload :loading="refreshing" @click="onRefresh" />
      </div>
    </template>

    <template #table-empty>
      <CustomEmpty v-if="trash.length" :title="$t('抱歉，没有找到匹配结果。')" class="py-12" />
      <CustomNewEmpty v-else icon="base/rx_ic_bin_2" img="empty-cloud-phone.png" :title="$t('回收站为空')" :desc="$t('已删除的云手机保留在回收站中，可随时恢复或彻底删除')" />
    </template>

    <template #name="{ data }">
      <span class="truncate" :title="data.name">{{ data.name }}</span>
    </template>

    <template #envId="{ data }">
      <span class="truncate" :title="data.id">{{ data.id }}</span>
    </template>

    <template #system="{ data }">
      <span class="cloud-phone-trash__system">{{ data.system }}</span>
    </template>
  </RyTable>
</template>

<style lang="scss" scoped>
.cloud-phone-trash {
  &__system {
    color: var(--colors-text-text-secondary);
  }
}
</style>
