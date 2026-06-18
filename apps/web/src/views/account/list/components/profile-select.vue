<script lang="ts" setup>
import ProfileInfo from '/@/views/browser/list/profiles/components/profile-info/index.vue'
import ProfileName from '/@/views/browser/list/profiles/components/profile-name.vue'
import ProjectIcon from '/@/views/browser/list/profiles/components/project-icon.vue'
import TagsIcon from '/@/views/browser/list/profiles/components/tags-icon.vue'
import AdvancedSearch from '/@/views/browser/list/profiles/components/advanced-search.vue'
import { getColumns } from '/@/views/browser/list/profiles/columns'
import { getAdvancedSearch, getSorts } from '/@/views/browser/list/profiles/operation'
import { API } from '/@/api'
import useColumns from '/@/hooks/useColumns'
import { useUserStore } from '/@/stores/user'
import { useWorkspaceStore } from '/@/stores/workspace'
import { getWorkspaceNamePrefix } from '/@/utils/workspace'
import { parseWindowInfo } from '../utils'

interface Props {
  account?: Record<string, any>
}

const { account } = defineProps<Props>()
const emit = defineEmits(['confirm', 'close'])

const workspaceStore = useWorkspaceStore()
const { userConfig } = storeToRefs(useUserStore())
const workspaceName = computed(() => getWorkspaceNamePrefix(workspaceStore.currentWorkspace?.workspaceName))
const linkedWindowSortNums = computed(() => parseWindowInfo(account?.window_info))
const advancedSearchOptions = getAdvancedSearch()
const { columns, updateColumns, updateRemarkDisplayStatus } = useColumns(
  getColumns(),
  ['open', 'actions', 'createTime', 'updateTime', 'openTime', 'transferUserName'],
)

const tableRef = useTemplateRef('profileSelect')
const selection = ref<any[]>([])

onBeforeMount(() => {
  updateColumns((cols) => {
    const noteColumn = cols.find(column => column.key === 'note')
    if (noteColumn?._cache) {
      Reflect.set(noteColumn._cache, 'extend', userConfig.value.remarkDisplayStatus!)
    }
  })
  void preloadLinkedSelection()
})

async function preloadLinkedSelection() {
  const sortNums = linkedWindowSortNums.value
  if (!sortNums.length)
    return

  const { code, data } = await API.window.userGetWindowInfoListList({
    page_index: 1,
    page_size: sortNums.length,
    sortNums: sortNums.join(','),
    isDelete: 0,
  } as any)

  if (code === 0)
    selection.value = data.rows
}

function onAdvancedSearch(search?: Record<string, any>) {
  const { key, value } = search || {}
  tableRef.value?.refresh({ queryKey: value && (key || 'name_remark'), queryValue: value }, true)
}

function mergeLinkedSelection(rows: any[]) {
  if (!linkedWindowSortNums.value.length)
    return

  const linkedSet = new Set(linkedWindowSortNums.value)
  const selectedIds = new Set(selection.value.map(item => item.id))
  const merged = [...selection.value]

  rows.forEach((row) => {
    if (linkedSet.has(row.windowSortNum) && !selectedIds.has(row.id)) {
      merged.push(row)
      selectedIds.add(row.id)
    }
  })

  if (merged.length !== selection.value.length)
    selection.value = merged
}

async function tableRequest(params: any) {
  const result = await API.window.userGetWindowInfoListList({
    ...params,
    isDelete: 0,
  })

  if (result.code === 0) {
    await nextTick()
    mergeLinkedSelection(result.data.rows)
  }

  return result
}

function toggleRemarkDisplayStatus(cache: Record<string, any>) {
  cache.extend = !cache.extend
  if (userConfig.value.remarkDisplayStatus !== cache.extend)
    updateRemarkDisplayStatus(cache.extend)
}

function handleSave() {
  emit('confirm', selection.value)
  emit('close')
}
</script>

<template>
  <div class="profile-select">
    <div class="profile-select__body">
      <AdvancedSearch class="profile-select__search" :options="advancedSearchOptions" :search="onAdvancedSearch" :clear="onAdvancedSearch" />
      <div class="profile-select__table">
        <RyTable
          ref="profileSelect"
          v-model:columns="columns"
          v-model:selection="selection"
          cache-key="account-profile-select"
          selection-mode="multiple"
          :multiple-operation="false"
          :table-request="tableRequest"
          :table-sort="getSorts"
          :show-table-header="false"
          :show-display="false"
          :show-reload="false"
          :show-actions="false"
          :context-menu="false"
          :virtual-scroller-options="{ itemSize: 60 }"
          removable-sort
          class="profile-select-table"
        >
          <template #table-empty>
            <CustomNewEmpty icon="base/rx_ic_browser" img="empty-profiles.png" :title="$t('暂无窗口')" :desc="$t('窗口是 Roxy浏览器的核心功能，可以帮助您管理多个浏览器窗口，并为它们设置不同的项目、平台账号、代理 IP 等，以方便您更好地执行业务操作。')" />
          </template>
          <template #profile="{ data }">
            <ProfileInfo :workspace-name="workspaceName" :data="data" readonly />
          </template>
          <template #profileName="{ data }">
            <ProfileName :data="data" readonly />
          </template>
          <template #noteHeader="{ column: { title, _cache } }">
            <div class="flex items-center gap-2 note-header">
              <span>{{ title }}</span>
              <SvgIcon
                v-tooltip.top="{ value: _cache.extend ? $t('收起') : $t('展开'), showDelay: 0 }"
                class="cursor-pointer color-[#989CA0]"
                :name="_cache.extend ? 'base/rx_ic_hidden' : 'base/rx_ic_eye'"
                @click.stop="toggleRemarkDisplayStatus(_cache)"
              />
            </div>
          </template>
          <template #note="{ data, column: { _cache } }">
            <div class="inline-flex items-center gap-1">
              <RxButton
                v-tooltip.top="{ value: data.windowRemark, showDelay: 0 }"
                class="shrink-0"
                :class="{ 'note-light': data.windowRemark }"
                text
                severity="secondary"
                size="xxs"
                :icon="data.windowRemark ? 'base/rx_ic_doc_fill' : 'base/rx_ic_doc_add'"
              />
              <div v-if="_cache.extend" :title="data.windowRemark" class="min-w-50 whitespace-pre-wrap note-content">
                {{ data.windowRemark }}
              </div>
            </div>
          </template>
          <template #project="{ data }">
            <ProjectIcon disabled :labels="data.labelInfo" :project-id="data.projectId" :project-name="data.projectName" />
          </template>
          <template #tags="{ data }">
            <TagsIcon disabled :labels="data.labelInfo" :project-id="data.projectId" :gen-tag="false" />
          </template>
        </RyTable>
      </div>
    </div>
    <div class="profile-select__footer">
      <RxButton size="md" severity="secondary" outlined :label="$t('取消')" @click.stop="emit('close')" />
      <RxButton size="md" :label="$t('确认并保存')" @click.stop="handleSave" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.profile-select {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-width: 960px;

  &__body {
    display: flex;
    flex: 1;
    flex-direction: column;
    gap: 12px;
    min-height: 0;
    padding: 12px 24px 0;
  }

  &__search {
    flex-shrink: 0;
  }

  &__table {
    flex: 1;
    min-height: 0;
    overflow: hidden;
  }

  &__footer {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-shrink: 0;
    padding: 16px;
  }
}

.note-header {
  color: var(--colors-text-text-primary);
  font-size: 12px;
  line-height: 16px;
  font-weight: 600;
}

.note-content {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  overflow: hidden;
  text-overflow: ellipsis;
  word-break: break-all;
  line-height: 1.4;
}

.note-light {
  :deep(svg) {
    color: var(--colors-text-text-brand, #11a3fd) !important;
  }
}

:deep(.profile-select-table) {
  height: 100%;
}
</style>
