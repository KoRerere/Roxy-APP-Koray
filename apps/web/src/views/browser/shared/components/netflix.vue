<script setup lang="tsx">
import AdvancedSearch from '/@/views/browser/list/profiles/components/advanced-search.vue'
import CustomFilters from '/@/views/browser/list/profiles/components/custom-filters.vue'
import DiskInsufficient from '/@/views/browser/list/profiles/components/disk-Insufficient.vue'
import ProfileInfo from '/@/views/browser/list/profiles/components/profile-info/index.vue'
import ProfileName from '/@/views/browser/list/profiles/components/profile-name.vue'
import BrowserControl from '/@/views/browser/list/profiles/components/browser-control.vue'
import TagsIcon from '/@/views/browser/list/profiles/components/tags-icon.vue'

import { API } from '/@/api'
import { useWorkspaceStore } from '/@/stores/workspace'
import { useDialog as RxUseDialog } from '/@/hooks/useDialog'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { filterFieldByValue, getDictMap, getFormData, isEmptyValue, isMacOS } from '/@/utils'
import type { UserGetWindowInfoListListData } from '@roxy/backend-api'

type Data = UserGetWindowInfoListListData['data']['rows'][number]

const workspaceStore = useWorkspaceStore()
const [showModal] = RxUseDialog()
const [_, onlyErrorToast] = useResponseToast()

const tableRef = useTemplateRef('shared')
const tabs = [
  { title: $t('全部窗口'), value: 'all' },
  { title: 'Windows', value: 'windows', params: { osList: 'Windows' } },
  { title: 'macOS', value: 'macos', params: { osList: 'macOS' } },
  { title: $t('可用的'), value: 'enable', params: { enableStatus: true } },
  { title: $t('已打开'), value: 'opened', params: { openStatus: true } },
]
const activeKey = ref(tabs[0]!.value)
const hasFiltered = ref(false)
const advancedSearchOptions = [
  {
    key: 'name',
    label: $t('窗口名称'),
    icon: 'base/rx_ic_browser',
    syntax: 'name::',
  },
  {
    key: 'remark',
    label: $t('备注'),
    icon: 'base/rx_ic_doc_article',
    syntax: 'note::',
  },
  {
    key: 'tag',
    label: $t('标签'),
    icon: 'base/rx_ic_tag',
    syntax: 'tag::',
  },

  {
    key: 'sortNum',
    label: ' ID',
    icon: 'base/rx_ic_id',
    syntax: 'id::',
  },
]
const filtersMenu = ref([
  {
    type: 'text',
    label: $t('窗口名称'),
    placeholder: $t('请输入窗口名称'),
    name: 'windowName',
    icon: 'base/rx_ic_browser',
  },
  {
    type: 'text',
    label: $t('序号'),
    placeholder: $t('请输入序号(多个用英文逗号分隔)'),
    name: 'sortNums',
    icon: 'base/rx_ic_id',
  },
  {
    type: 'Checkbox',
    label: $t('操作系统'),
    name: 'osList',
    icon: 'base/rx_ic_laptop',
    getOptions: async () => {
      const $dict_map = await getDictMap()
      return ($dict_map.os || []).map((item: any) => ({
        parentName: 'osList',
        value: item.value,
        label: item.label,
      }))
    },
    formatValue: (input: any) => {
      return input.value?.map((item: any) => item.value)
    },
  },
  {
    type: 'Checkbox',
    name: 'labelIds',
    label: $t('标签'),
    icon: 'base/rx_ic_tag',
    getOptions: async () => {
      const { data } = await API.window.userGetLabelInfoList({ page_index: '1', page_size: '999' })
      return (data.rows || []).map(item => ({
        parentName: 'labelIds',
        value: `${item.id}`,
        label: item.name,
      }))
    },
    formatValue: (input: any) => {
      return input.value?.map((item: any) => item.value)
    },
  },
  {
    type: 'textarea',
    label: $t('备注'),
    placeholder: $t('请输入备注'),
    name: 'windowRemark',
    icon: 'base/rx_ic_doc_article',
  },
])
const columns = [
  {
    title: 'ID',
    key: 'windowSortNum',
    disabledToggle: true,
    sortable: true,
    slot: 'profile',
    style: {
      width: '0%',
      minWidth: '180px',
    },
  },
  {
    title: $t('窗口名称'),
    key: 'name',
    disabledToggle: true,
    sortable: true,
    slot: 'name',
    style: {
      width: '10%',
      minWidth: '240px',
    },
  },
  {
    title: $t('操作'),
    key: 'open',
    disabledToggle: true,
    slot: 'open',

  },
  {
    title: $t('备注'),
    key: 'note',
    slot: 'note',
  },
  {
    title: $t('标签'),
    key: 'tags',
    slot: 'tags',
  },
]
const openMessage = reactive<any>({})

const workspaceName = computed(() => workspaceStore.currentWorkspace?.workspaceName?.slice(0, 3).toLocaleUpperCase())
const activeTable = computed(() => tabs.find(item => item.value === activeKey.value))

const openLimit = ref(false)

let canceOpenlListener: any
let canceCloselListener: any
let canceCloseSyncingDataListener: any

onBeforeMount(() => {
  checkOpenLimit()
  canceOpenlListener = listenOpenMessage()
  canceCloselListener = listenCloseMessage()
  canceCloseSyncingDataListener = listenCloseSyncingDataMessage()

  window.electronAPI
    .send('browser:getOpenedBrowserMessage')
    .then((state) => {
      console.log('browser:getOpenedBrowserMessage state', state)
      state.forEach((item: any) => {
        Reflect.set(openMessage, item.dirId, { data: item })
      })
    })
})

function listenOpenMessage() {
  return window.electronAPI.on('browser:launch-process-message', (event) => {
    if (event.code === 1) {
      openLimit.value = false
    }

    if (event.code === 1 && event.message.includes('ERR101')) {
      showDiskSpaceModal()
    }
    const id = event.data?.dirId || event.data
    Reflect.set(openMessage, id as string, event)
  })
}

function listenCloseMessage() {
  return window.electronAPI.on('browser:on-close', (dirIds) => {
    openLimit.value = false
    dirIds.forEach((dirId) => {
      Reflect.deleteProperty(openMessage, dirId)
    })
  })
}

async function checkOpenLimit() {
  const count = await window.electronAPI.send('browser:getOpenedBrowserCount', workspaceStore.currentWorkspace?.id)
  openLimit.value = count > 0
}

async function openBrowserBefore(item: Data) {
  if (Reflect.get(openMessage, item.dirId!)) {
    window.electronAPI.send('browser:batchLaunch', [item.dirId!])
    return
  }

  if ((isMacOS && item.os !== 'macOS') || (!isMacOS && item.os !== 'Windows')) {
    onlyErrorToast(-1, $t('请选择与您当前设备匹配的窗口系统 ({os})', { os: isMacOS ? 'Mac' : 'Windows' }))
    return
  }

  await checkOpenLimit()

  if (openLimit.value) {
    onlyErrorToast(-1, $t('切换窗口前，请先关闭已打开的窗口'))
    return
  }

  const { code, data, msg } = await API.window.userGetWindowStatusInfoCreate({ ids: [item.id!] })
  onlyErrorToast(code, msg)
  if (code !== 0)
    return
  if (data[0]!.statusInfo?.length >= 4) {
    onlyErrorToast(-1, $t('当前窗口人数已达上限，请更换其他窗口'))
    Reflect.set(item, 'statusInfo', data[0]!.statusInfo)
    return
  }
  openLimit.value = true
  Reflect.set(openMessage, item.dirId!, { pending: true, data: { message: $t('启动中...') } })
  window.electronAPI.send('browser:batchLaunch', [item.dirId!])
}

function listenCloseSyncingDataMessage() {
  return window.electronAPI.on('browser:on-close-syncing-data', (dirIds) => {
    dirIds.forEach((dirId) => {
      const message = Reflect.get(openMessage, dirId)
      if (message?.data) {
        message.uploading = true
        message.data.message = $t('同步数据中...')
      }
    })
  })
}

async function tableRequest(params: any) {
  return API.window.userGetWindowInfoListList({ ...params, isDelete: 0 })
}

function onRefreshTable(tabParams = {}, force = false) {
  const params = {
    ...tabParams,
    ...filterFieldByValue(getFormData(filtersMenu.value)),
    ...activeTable.value?.params,
  }
  hasFiltered.value = !isEmptyValue(params)
  tableRef.value?.refresh(params, force)
}

function onAdvancedSearch(search?: Record<string, any>) {
  const { key, value } = search || {}
  onRefreshTable({ queryKey: value && (key || 'name_remark'), queryValue: value }, true)
}

function showDiskSpaceModal() {
  showModal({
    header: $t('磁盘空间不足'),
    showHeader: false,
    modal: true,
    blockScroll: true,
    pt: {
      content: '!pa-0',
    },
    slots: {
      container: ({ hideModal }) => h(DiskInsufficient, { onClose: hideModal }),
    },
  })
}
</script>

<template>
  <div class="flex flex-col h-full w-full">
    <RxTabs v-model:value="activeKey" :tabs="tabs" head-tabs only-tabs @update:value="onRefreshTable({}, true)" />
    <div class="flex-1 overflow-hidden">
      <RyTable ref="shared" v-model:columns="columns" removable-sort :table-request="tableRequest" :page-rows="100" :show-actions="false" :show-display="false">
        <template #filter-after>
          <div class="w-full flex items-start gap-2">
            <AdvancedSearch :options="advancedSearchOptions" :search="onAdvancedSearch" :clear="onAdvancedSearch" />
            <RxDivider class="py-1" vertical line-only />
            <CustomFilters :filters-menu="filtersMenu" :enabled-filter-save="false" @filter-change="onRefreshTable" />
          </div>
        </template>
        <template #table-empty>
          <CustomEmpty v-if="hasFiltered" icon="rx_illustration_filter.svg" :title="$t('暂无查询结果')" :desc="$t('当前条件下没有匹配的结果，请尝试更换其他筛选条件。')" />
        </template>
        <template #profile="{ data }">
          <template v-if="data.id">
            <ProfileInfo :workspace-name="workspaceName!" :data="data" :open-message="openMessage" readonly />
          </template>
          <div v-else class="flex items-center gap-[16px]">
            <Skeleton width="44px" height="16px" />
            <div class="flex items-center gap-[1px]">
              <template v-for="i in 3" :key="i">
                <div v-if="i > 1" class="dotted-line" />
                <Skeleton width="24px" height="24px" border-radius="4px" />
              </template>
            </div>
          </div>
        </template>
        <template #name="{ data }">
          <template v-if="data.id">
            <ProfileName :data="data" readonly />
          </template>
          <template v-else>
            <Skeleton width="160px" height="24px" border-radius="4px" />
          </template>
        </template>
        <template #open="{ data }">
          <template v-if="data.id">
            <BrowserControl icon="base/rx_ic_play_full" :text="$t('播放')" :disabled="(openLimit && !openMessage[data.dirId]) || data.statusInfo?.length >= 4" :data="data" :open-message="openMessage"
                            is-public @open="openBrowserBefore"
            />
          </template>
          <template v-else>
            <Skeleton width="70px" height="24px" border-radius="4px" />
          </template>
        </template>
        <template #note="{ data }">
          <template v-if="data.id">
            <div class="inline-flex items-center gap-1">
              <RxButton v-tooltip.top="{ value: data.windowRemark, showDelay: 0 }" class="shrink-0" :class="{ light: data.windowRemark }" text size="xxs" severity="secondary"
                        :icon="data.windowRemark ? 'base/rx_ic_doc_fill' : 'base/rx_ic_doc_add'"
              />
              <div class="select-none min-w-30 whitespace-pre-wrap note" :title="data.windowRemark">
                {{ data.windowRemark }}
              </div>
            </div>
          </template>
          <template v-else>
            <Skeleton width="24px" height="24px" border-radius="4px" />
          </template>
        </template>
        <template #tags="{ data }">
          <template v-if="data.id">
            <TagsIcon :labels="data.labelInfo" disabled />
          </template>
          <template v-else>
            <Skeleton width="70px" height="24px" border-radius="12px" />
          </template>
        </template>
      </RyTable>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.light {
  :deep(svg) {
    color: var(--colors-text-text-brand) !important;
  }
}

.note {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  overflow: hidden;
  text-overflow: ellipsis;
  word-break: break-all;
  line-height: 1.4;
}
</style>
