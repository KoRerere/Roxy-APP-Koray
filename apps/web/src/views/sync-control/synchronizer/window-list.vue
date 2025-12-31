<script setup lang="ts">
import TsFormInputText from '/@/views/lab/components/form/m-input-text.vue'
import TsFormMultiSelect from '/@/views/lab/components/form/m-input-multi-select.vue'
import ProfileInfo from '/@/views/browser/list/profiles/components/profile-info/index.vue'
import TutorialVideo from '/@/views/tutorial/components/tutorial-video.vue'
import { useToast } from 'primevue/usetoast'
import { useUserStore } from '/@/stores/user'
import { useMutationObserver } from '@vueuse/core'
import { debounce } from 'es-toolkit'

interface Props {
  selectionMode?: 'single' | 'multiple'
  showType?: 'opened' | 'syncing'
  mainControlWindowDirId?: string
}

interface SearchParams {
  projectIds: string[]
  labelIds: string[]
  os: string[]
  windowName: string
}

const props = withDefaults(defineProps<Props>(), {
  showType: 'opened',
  mainControlWindowDirId: '',
})

const syncControlTableRef = useTemplateRef('syncControlTable')
const toast = useToast()
const { mixpanelTrack } = useUserStore()

const searchParams = ref<SearchParams>({
  projectIds: [],
  labelIds: [],
  os: [],
  windowName: '',
})
const tableData = ref<any[]>([])
const mainControlWindowDirId = ref(props.mainControlWindowDirId)
const columns = ref([
  {
    title: $t('窗口信息'),
    key: 'profile',
    slot: 'profile',
    style: {
      width: '0%',
      minWidth: '125px',
    },
  },
  {
    title: $t('窗口名称'),
    key: 'windowName',
    slot: 'windowName',
    style: {
      width: '10%',
      minWidth: '120px',
    },
  },
  {
    title: $t('状态'),
    key: 'status',
    slot: 'status',
    style: {
      width: '25%',
    },
  },
  {
    title: $t('操作'),
    key: 'actions',
    slot: 'actions',
    style: {
      width: '10%',
    },
  },
])

const selectedRows = ref()

const selectedRowsFilter = computed(() => {
  return selectedRows.value?.filter((n: any) => n.$canUseSyncControl)
})

const isSyncing = computed(() => {
  return props.showType === 'syncing'
})

useMutationObserver(() => syncControlTableRef.value?.rootElRef, (mutations) => {
  if (mutations[0]) {
    setTimeout(() => {
      if (tableData.value.length > 1) {
        const tableContainer = document.querySelector('.p-datatable-table-container')
        console.log('tableContainer scrollWidth', tableContainer?.scrollWidth)
        electronAPI.send('app:resizeWindow', {
          width: window.innerWidth + (tableContainer?.scrollWidth ?? 0) - (tableContainer?.clientWidth ?? 0),
          height: window.innerHeight,
        })
      }
    }, 60)
  }
}, {
  childList: true,
  subtree: true,
})

const disabled = computed(() => {
  if (!selectedRowsFilter.value?.length)
    return true

  return selectedRowsFilter.value?.length < 2 || !selectedRowsFilter.value?.some((n: any) => n.dirId === mainControlWindowDirId.value)
})

const searchList = computed(() => {
  return [
    {
      name: 'projectIds',
      placeholder: $t('全部项目'),
      options: tableData.value.reduce((acc, curr) => {
        if (!acc.find((n: any) => n.value === curr.projectId)) {
          acc.push({ label: curr.projectName, value: curr.projectId })
        }
        return acc
      }, []),
    },
    {
      name: 'labelIds',
      placeholder: $t('全部标签'),
      options: tableData.value.flatMap(n => n.labelInfo).reduce((acc, curr) => {
        if (!acc.find((n: any) => n.value === curr.labelId)) {
          acc.push({ ...curr, label: curr.labelName, value: curr.labelId })
        }
        return acc
      }, []),
    },
    {
      name: 'os',
      placeholder: $t('全部系统'),
      options: tableData.value.reduce((acc, curr) => {
        if (!acc.find((n: any) => n.value === curr.os)) {
          acc.push({ label: curr.os === 'IOS' ? 'iOS' : curr.os, value: curr.os })
        }
        return acc
      }, []),
    },
  ]
})

const tableFilterData = computed(() => {
  return tableData.value.filter((n: any) => {
    return (!searchParams.value.projectIds.length || searchParams.value.projectIds.includes(n.projectId))
      && (!searchParams.value.labelIds.length || n.labelInfo.some((m: any) => searchParams.value.labelIds.includes(m.labelId)))
      && (!searchParams.value.os.length || searchParams.value.os.includes(n.os))
      && (!searchParams.value.windowName || n.windowName.includes(searchParams.value.windowName))
  })
})

const disabledRows = debounce(() => {
  document.querySelectorAll('.p-datatable-selectable-row:not(:has(.can-use-sync-control))').forEach((n) => {
    const dialogMask = n.querySelector<HTMLDivElement>('.disable-mask')
    if (!dialogMask) {
      const dialogMask = document.createElement('div')
      dialogMask.setAttribute('title', $t('免费套餐的窗口，无法进行同步'))
      dialogMask.onclick = (event: MouseEvent) => {
        event.stopPropagation()
      }
      dialogMask.classList.add('disable-mask')
      n.appendChild(dialogMask)
    }
  })
}, 100)

watch(tableFilterData, (val) => {
  if (val.length > 1) {
    disabledRows()
    if (!props.mainControlWindowDirId) {
      const canUseWindows = val.filter(n => n.$canUseSyncControl)
      mainControlWindowDirId.value = canUseWindows.some(n => n.dirId === mainControlWindowDirId.value) ? mainControlWindowDirId.value : canUseWindows[0].dirId
    }
  }
})

window.electronAPI.on('browser:on-close', (dirIds) => {
  selectedRows.value = selectedRows.value?.filter((n: any) => !dirIds.includes(n.dirId))
  getOpenedBrowser()
})
window.electronAPI.on('browser:opened-browser-list-change', (data) => {
  console.log('browser:opened-browser-list-change', data)
  if (!isSyncing.value) {
    tableData.value = data
  }
})

async function getOpenedBrowser() {
  tableData.value = await window.electronAPI.send(isSyncing.value ? 'syncControl:getAllSyncingWindows' : 'browser:getOpenedBrowser')
  console.log('tableData.value', tableData.value)
}

function viewBrowser(dirId: string) {
  window.electronAPI.send('browser:batchLaunch', [dirId])
}

onMounted(() => {
  getOpenedBrowser()
})

async function startSync() {
  if (selectedRowsFilter.value?.length < 2) {
    console.log('Please open at least two windows first', selectedRowsFilter.value?.length)
    return
  }

  const hasWindows = selectedRowsFilter.value.find((item: any) => ['Windows', 'macOS', 'Linux'].includes(item.platform))
  const hasMobile = selectedRowsFilter.value.find((item: any) => ['Android', 'IOS'].includes(item.platform))
  if (hasWindows && hasMobile) {
    toast.add({ severity: 'warn', summary: $t('同步窗口失败'), detail: $t('桌面系统的窗口暂时无法和手机系统的窗口进行同步操作') })
    return
  }
  console.log('startSync', selectedRowsFilter.value)
  const dirIds = [...new Set([
    mainControlWindowDirId.value,
    ...selectedRowsFilter.value?.map((n: any) => n.dirId),
  ])]
  console.log('dirIds', dirIds)
  await window.electronAPI.send('syncControl:start', dirIds)
  mixpanelTrack('synchronizer_success')
}

async function handleRowSelectAll() {
  await nextTick()
  document.querySelectorAll('.p-datatable-selectable-row:not(:has(.can-use-sync-control))').forEach((n) => {
    const checkboxChecked = n.querySelector<HTMLDivElement>('.p-checkbox-checked')
    if (checkboxChecked) {
      checkboxChecked.classList.remove('p-checkbox-checked')
      const checkboxIcon = checkboxChecked.querySelector<HTMLDivElement>('.p-checkbox-icon')
      if (checkboxIcon) {
        checkboxIcon.style.display = 'none'
      }
    }
  })
}

electronAPI.on('syncControl:start', startSync)
</script>

<template>
  <RyTable ref="syncControlTable" v-model:selection="selectedRows" :multiple-operation="false" :data-list="tableFilterData" :columns="columns" :selection-mode="selectionMode" :paginator="false"
           :show-actions="false" :show-display="false" :show-reload="false" :context-menu="false" class="sync-control-table" :class="{ 'syncing': isSyncing, 'no-data': tableFilterData.length === 0 }"
           v-bind="$attrs" @row-select-all="handleRowSelectAll"
  >
    <template v-if="!isSyncing && tableData.length" #table-header>
      <div class="w-full flex gap-2.5">
        <TsFormMultiSelect v-for="{ name, ...other } in searchList" :key="name" v-model="searchParams[name as keyof typeof searchParams]" class="flex-1 min-w-0" v-bind="other" size="xxs"
                           :max-selected-labels="1" :show-toggle-all="false" :filter="false"
        >
          <template #option="slotProps">
            <template v-if="name === 'labelIds'">
              <div v-if="slotProps.option.value.startsWith?.('u_')" class="flex items-center gap-2">
                <RxAvatar :avatar="slotProps.option.avatar" :name="slotProps.option.label?.slice(0, 2)" :color="slotProps.option.labelColor" :size="18" :font-size="10" />
                <span class="text-3.25">{{ slotProps.option.label }}</span>
              </div>
              <div v-else class="flex items-center">
                <svg class="shrink-0" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M5 8C5 6.34315 6.34315 5 8 5C9.65685 5 11 6.34315 11 8C11 9.65685 9.65685 11 8 11C6.34315 11 5 9.65685 5 8Z" :fill="slotProps.option.labelColor" />
                </svg>
                <div class="text-3.25 ellipsis-1">
                  {{ slotProps.option.labelName }}
                </div>
              </div>
            </template>
            <div v-else class="flex items-center">
              <div class="text-3.25">
                {{ slotProps.option.label }}
              </div>
            </div>
          </template>
        </TsFormMultiSelect>
        <TsFormInputText v-model="searchParams.windowName" :field-props="{ class: 'flex-1 min-w-0' }" pre-icon="base/rx_ic_magnify" size="xxs" :placeholder="$t('搜索窗口')" />
      </div>
    </template>
    <template #table-empty>
      <CustomEmpty v-if="tableData.length && tableFilterData.length === 0" icon="rx_illustration_filter.svg" :title="$t('暂无查询结果')" :desc="$t('当前条件下没有匹配的结果，请尝试更换其他筛选条件。')" />
      <CustomEmpty v-else icon="rx_illustration_roxybrowser.png" :title="$t('请先打开至少两个窗口')">
        <template #desc>
          <div class="whitespace-pre-wrap text-[var(--colors-text-text-tertiary)] text-3.5">
            {{ $t('窗口同步：即窗口群控，可同时控制多个窗口，实现鼠标同步，键盘同步，大幅提高工作效率。') }}
          </div>
          <div class="mt-[16px] whitespace-pre-wrap text-[var(--colors-text-text-tertiary)] text-3.5">
            {{ $t('注意：不同操作系统的窗口无法进行同步，相同系统但内核不一致的窗口，有概率出现同步失败的情况。') }}
          </div>
          <div v-if="false" class="mt-3">
            <i18n-t :keypath="$t('更多的文档说明，请访问：{link}', { link: '{link}' })" scope="global">
              <template #link>
                <a href="https://faq.roxybrowser.com/" target="_blank">{{ $t('窗口同步器') }}</a>
              </template>
            </i18n-t>
          </div>
        </template>
        <template #extra>
          <TutorialVideo variant="outlined" size="xs" video-type="synchronizer" :autoplay="false" />
        </template>
      </CustomEmpty>
    </template>
    <template #profile="{ data }">
      <ProfileInfo :workspace-name="data?.workspaceName?.slice(0, 3).toLocaleUpperCase()" :data="data" :filter-keys="['os']" readonly :class="{ 'can-use-sync-control': data.$canUseSyncControl }" />
    </template>
    <template #windowName="{ data }">
      <div v-tooltip.top="{ value: data.windowName }" class="ellipsis-1 max-w-150px">
        {{ data.windowName }}
      </div>
    </template>
    <template #status="{ data }">
      <div v-if="data.dirId === mainControlWindowDirId" class="main-control-status select-none">
        {{ $t('主控窗口') }}
      </div>
      <div v-else class="status" :class="{ action: !isSyncing }">
        <span class="status-text">--</span>
        <RxButton class="status-btn" size="xxs" severity="secondary" icon="base/rx_ic_cursor" :label="$t('设为主控')" @click.stop="isSyncing || (mainControlWindowDirId = data.dirId)" />
      </div>
    </template>
    <template #actions="{ data }">
      <RxButton size="xxs" variant="text" severity="secondary" icon="base/rx_ic_show_profile" :label="$t('查看')" @click.stop="viewBrowser(data.dirId)" />
    </template>
  </RyTable>
  <RxButton v-if="showType === 'opened'" :disabled="disabled" :label="selectedRowsFilter?.length
    ? $t('开始同步 {count} 个窗口', { count: selectedRowsFilter.length })
    : $t('开始同步')" class="start-sync-btn" @click.stop="startSync"
  />
</template>

<style lang="scss">
.no-data {
  .p-datatable-thead {
    display: none;
  }
}

.p-datatable-selectable-row:not(:has(.can-use-sync-control)) {
  position: relative;
  opacity: 0.5;

  .disable-mask {
    content: '';
    position: absolute;
    width: 100%;
    height: 100%;
    top: 0;
    left: 0;
    cursor: not-allowed;
    z-index: 10;
  }
}

.p-datatable-table-container {
  border-radius: 8px;
  overflow: hidden;
  background: var(--colors-background-bg-page, #05101a);

  td[data-pc-section='emptymessagecell'] {
    border: none;
  }
}

.p-datatable-table-container {
  padding: 12px;

  .p-datatable-thead {
    &::before {
      content: '';
      position: absolute;
      width: 100%;
      height: 20px;
      background: var(--colors-background-bg-page, #05101a);
      top: -20px;
    }

    th.p-datatable-header-cell {
      border-top-width: 0.5px;
      border-top-color: var(--colors-border-border-subtle, #e4e8eb);
    }

    th.p-datatable-header-cell:first-of-type {
      border: 0.5px solid var(--colors-border-border-inactive, #293038);
      border-right-width: 0;
      border-top-left-radius: var(--radius-sm, 4px);
      border-bottom-left-radius: var(--radius-sm, 4px);
    }

    th.p-datatable-header-cell:last-of-type {
      border: 0.5px solid var(--colors-border-border-inactive, #293038);
      border-left-width: 0;
      border-top-right-radius: var(--radius-sm, 4px);
      border-bottom-right-radius: var(--radius-sm, 4px);
    }
  }

  td {
    &:first-of-type {
      padding-left: var(--spacing-4xl, 24px) !important;
    }
  }
}
</style>

<style lang="scss" scoped>
.sync-control-table {
  overflow: hidden;
  border: 0.5px solid var(--colors-border-border-inactive, #c7cdd1);
  border-radius: var(--radius-sm, 6px);

  &.syncing {
    :deep(.p-datatable-thead) {
      display: none;
    }
  }

  :deep(.rx-header) {
    padding: 12px;
    padding-bottom: 0;
    border-bottom: 0;
    background-color: var(--colors-background-bg-page, #05101a);

    .p-multiselect-label {
      height: 100%;
    }
  }

  :deep(.table-wrapper) {
    border-top: none;
  }
}

.main-control-status {
  display: inline-flex;
  padding: 3px 5px;
  justify-content: center;
  align-items: center;
  gap: 10px;
  border-radius: 4px;
  background: var(--primitives-blue-400, #7eccfc);
  color: var(--primitives-blue-700, #015c94);
  font-size: 12px;
  font-weight: bold;
  line-height: var(--Line-Height-text-xs, 16px);
}

.status {
  &.action:hover {
    .status-text {
      display: none;
    }

    .status-btn {
      display: flex;
    }
  }

  &-btn {
    display: none;
  }
}

.start-sync-btn {
  width: 100%;
}

.disable-set-main {
  cursor: not-allowed;
  opacity: 0.4;
}
</style>
