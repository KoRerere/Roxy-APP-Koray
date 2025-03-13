<script setup lang="ts">
import { useToast } from 'primevue/usetoast'
import { API } from '/@/api'
import { RxSvgIcon } from '/@/components/rx-icon'
import { $t } from '/@/locales'
import { useWorkspaceStore } from '/@/stores/workspace'
import ProfileInfo from '/@/views/browser/list/profiles/components/profile-info.vue'
import { format } from 'date-fns'
import { useMutationObserver } from '@vueuse/core'

const props = defineProps({
  showType: {
    type: String as PropType<'opened' | 'syncing'>,
    default: 'opened',
  },
  selectionMode: {
    type: String as PropType<'single' | 'multiple'>,
  },
  mainControlWindowDirId: {
    type: String,
    default: '',
  },

})

const syncControlTableRef = useTemplateRef('syncControlTable')
const toast = useToast()
const workspaceStore = useWorkspaceStore()

const searchParams = ref({
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
      width: '50%'
    }
  },
  {
    title: $t('状态'),
    key: 'status',
    slot: 'status',
    style: {
      width: '25%'
    }
  },
  {
    title: $t('操作'),
    key: 'actions',
    slot: 'actions',
    style: {
      width: '25%'
    }
  },
])

const selectedRows = ref()

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
          width: window.innerWidth + tableContainer?.scrollWidth - tableContainer?.clientWidth,
          height: window.innerHeight
        })
      }
    }, 60)
  }
}, {
  childList: true,
  subtree: true,
})


const workspaceName = computed(() => workspaceStore.currentWorkspace?.workspaceName?.slice(0, 3).toLocaleUpperCase())

const disabled = computed(() => {
  if (!selectedRows.value?.length) return true

  return selectedRows.value?.length < 2 || !selectedRows.value?.some((n: any) => n.dirId === mainControlWindowDirId.value)
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
      }, [])
    },
    {
      name: 'labelIds',
      placeholder: $t('全部标签'),
      options: tableData.value.flatMap(n => n.labelInfo).reduce((acc, curr) => {
        if (!acc.find((n: any) => n.value === curr.labelId)) {
          acc.push({ ...curr, label: curr.labelName, value: curr.labelId })
        }
        return acc
      }, [])
    },
    {
      name: 'os',
      placeholder: $t('全部系统'),
      options: tableData.value.reduce((acc, curr) => {
        if (!acc.find((n: any) => n.value === curr.os)) {
          acc.push({ label: curr.os, value: curr.os })
        }
        return acc
      }, [])
    },
  ]
})

const tableFilterData = computed(() => {
  return tableData.value.filter((n: any) => {
    return (!searchParams.value.projectIds.length || searchParams.value.projectIds.includes(n.projectId)) &&
      (!searchParams.value.labelIds.length || n.labelInfo.some((m: any) => searchParams.value.labelIds.includes(m.labelId))) &&
      (!searchParams.value.os.length || searchParams.value.os.includes(n.os)) &&
      (!searchParams.value.windowName || n.windowName.includes(searchParams.value.windowName))
  })
})

watch(tableFilterData, (val) => {
  if (val.length > 1) {
    if (!props.mainControlWindowDirId) {
      mainControlWindowDirId.value = val[0].dirId
    }
  }
})

window.electronAPI.on('browser:launch-process-message', (event) => {
  getOpenedBrowser()
})

window.electronAPI.on('browser:on-close', (dirId) => {
  selectedRows.value = selectedRows.value?.filter((n: any) => n.dirId !== dirId)
  getOpenedBrowser()
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

function startSync() {
  if (selectedRows.value?.length < 2) {
    console.log('请先打开至少两个窗口', selectedRows.value?.length)
    return
  }

  const hasWindows = selectedRows.value.find(item => ['Windows', 'macOS'].includes(item.platform))
  const hasMobile = selectedRows.value.find(item => ['Android', 'IOS'].includes(item.platform))
  if (hasWindows && hasMobile) {
    toast.add({ severity: 'warn', summary: $t('同步窗口失败'), detail: $t('桌面系统的窗口暂时无法和手机系统的窗口进行同步操作') })
    return
  }
  console.log('startSync', selectedRows.value)
  const dirIds = [...new Set([
    mainControlWindowDirId.value,
    ...selectedRows.value?.map((n: any) => n.dirId)
  ])
  ]
  console.log('dirIds', dirIds)
  window.electronAPI.send('syncControl:start', dirIds)
}

electronAPI.on('syncControl:start', startSync)
</script>

<template>
  <RyTable ref="syncControlTable" v-model:selection="selectedRows" :multipleOperation="false"
    :data-list="tableFilterData" :columns="columns" :selection-mode="selectionMode" :paginator="false"
    :show-actions="false" :show-display="false" :context-menu="false" class="sync-control-table"
    :class="{ syncing: isSyncing, 'no-data': tableFilterData.length === 0 }" v-bind="$attrs">
    <template v-if="!isSyncing && tableData.length" #table-header>
      <div class="w-full flex justify-between">
        <template v-for="item in searchList" :key="item.name">
          <MultiSelect v-model="searchParams[item.name]" :options="item.options" :showToggleAll="false"
            optionLabel="label" optionValue="value" :placeholder="item.placeholder" :maxSelectedLabels="1" size="small">
            <template #option="slotProps">
              <template v-if="item.name === 'labelIds'">
                <div v-if="slotProps.option.value.startsWith?.('u_')" class="flex items-center gap-2">
                  <RxAvatar :avatar="slotProps.option.avatar" :name="slotProps.option.label?.slice(0, 2)"
                    :color="slotProps.option.labelColor" :size="18" :font-size="10" />
                  <span>{{ slotProps.option.label }}</span>
                </div>
                <div v-else class="flex items-center">
                  <svg class="shrink-0" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16"
                    fill="none">
                    <path
                      d="M5 8C5 6.34315 6.34315 5 8 5C9.65685 5 11 6.34315 11 8C11 9.65685 9.65685 11 8 11C6.34315 11 5 9.65685 5 8Z"
                      :fill="slotProps.option.labelColor" />
                  </svg>
                  <div class="ellipsis-1">
                    {{ slotProps.option.labelName }}
                  </div>
                </div>
              </template>
              <div v-else class="flex items-center">
                <div>{{ slotProps.option.label }}</div>
              </div>
            </template>
          </MultiSelect>
        </template>
        <IconField>
          <InputIcon class="pi pi-search" />
          <InputText v-model="searchParams.windowName" placeholder="Search" class="w-[120px]" size="small" />
        </IconField>
      </div>
    </template>
    <template #table-empty>
      <CustomEmpty v-if="tableData.length && tableFilterData.length === 0" icon="rx_illustration_filter.svg"
        :title="$t('暂无查询结果')" :desc="$t('当前条件下没有匹配的结果，请尝试更换其他筛选条件。')" />
      <CustomEmpty v-else icon="rx_illustration_roxybrowser.png" :title="$t('请先打开至少两个窗口')">
        <template #desc>
          <div class="whitespace-pre-wrap">
            {{ $t('窗口同步：即窗口群控，可同时控制多个窗口，实现鼠标同步，键盘同步，大幅提高工作效率。') }}
          </div>
          <div class="mt-[16px] whitespace-pre-wrap">
            {{ $t('注意：不同操作系统的窗口无法进行同步，相同系统但内核不一致的窗口，有概率出现同步失败的情况。') }}
          </div>
          <div v-if="false" class="mt-3">
            <i18n-t :keypath="$t('更多的文档说明，请访问：{link}', { link: '{link}' })" scope="global">
              <template #link>
                <a href="https://faq.roxybrowser.org/" target="_blank">{{ $t('窗口同步器') }}</a>
              </template>
            </i18n-t>
          </div>
        </template>
      </CustomEmpty>
    </template>
    <template #profile="{ data }">
      <ProfileInfo :workspace-name="workspaceName" :data="data" :filter-keys="['os']" readonly />
    </template>
    <template #status="{ data }">
      <div v-if="data.dirId === mainControlWindowDirId" class="main-control-status">
        {{ $t('主控窗口') }}
      </div>
      <template v-else>
        --
      </template>
    </template>
    <template #actions="{ data }">
      <div class="flex gap-2 cursor-pointer">
        <RxSvgIcon v-tooltip="$t('预览')" name="base/rx_ic_show_profile" @click.stop="viewBrowser(data.dirId)" />
        <span v-tooltip="$t('设为主控')">
          <RxSvgIcon name="base/rx_ic_cursor" :class="{ 'disable-set-main': isSyncing }"
            @click.stop="isSyncing || (mainControlWindowDirId = data.dirId)" />
        </span>
      </div>
    </template>
  </RyTable>
  <RxButton v-if="showType === 'opened'" :disabled="disabled" :label="selectedRows?.length
    ? $t('开始同步 {count} 个窗口', { count: selectedRows.length })
    : $t('开始同步')" class="start-sync-btn" @click.stop="startSync" />
</template>

<style lang="scss">
.no-data {
  .p-datatable-thead {
    display: none;
  }
}

.p-datatable-table-container {
  border-radius: 8px;
  overflow: hidden;
  background-color: white;

  td[data-pc-section="emptymessagecell"] {
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
      background-color: white;
      top: -20px;
    }

    th.p-datatable-header-cell {
      border-top-width: 0.5px;
      border-top-color: var(--Colors-Border-border-subtle, #E4E8EB);
    }

    th.p-datatable-header-cell:first-of-type {
      border: 0.5px solid var(--Colors-Border-border-subtle, #E4E8EB);
      border-right-width: 0;
      border-top-left-radius: var(--radius-sm, 4px);
      border-bottom-left-radius: var(--radius-sm, 4px);
    }

    th.p-datatable-header-cell:last-of-type {
      border: 0.5px solid var(--Colors-Border-border-subtle, #E4E8EB);
      border-left-width: 0;
      border-top-right-radius: var(--radius-sm, 4px);
      border-bottom-right-radius: var(--radius-sm, 4px);
    }
  }

  td {
    padding: 10px 6px !important;

    &:first-of-type {
      padding-left: var(--spacing-4xl, 24px) !important;
    }
  }
}
</style>

<style lang="scss" scoped>
.sync-control-table {
  overflow: hidden;
  border: 0.5px solid var(--Colors-Border-border-container, #C7CDD1);
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
    background-color: white;
  }

}

.main-control-status {
  display: inline-flex;
  padding: 3px 5px;
  justify-content: center;
  align-items: center;
  gap: 10px;
  border-radius: 4px;
  background: var(--Color-blue-200, #7ECCFC);
  color: var(--Color-blue-500, #015C94);
  font-size: 12px;
  font-weight: bold;
  line-height: var(--Line-Height-text-xs, 16px);
}

.start-sync-btn {
  width: 100%;
}

.disable-set-main {
  cursor: not-allowed;
  opacity: 0.4;
}
</style>
