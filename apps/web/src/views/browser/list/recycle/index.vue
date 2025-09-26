<script setup lang="tsx">
import RestoreReminderDialog from './restore-reminder-dialog.vue'
import AdvancedSearch from '/@/views/browser/list/profiles/components/advanced-search.vue'
import profileInfo from '/@/views/browser/list/profiles/components/profile-info/index.vue'
import TagsIcon from '/@/views/browser/list/profiles/components/tags-icon.vue'
import { $t } from '/@/locales'
import { API } from '/@/api'
import { useDialog } from '/@/hooks/useDialog'
import { useConfirm } from 'primevue/useconfirm'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { useWorkspaceStore } from '/@/stores/workspace'
import { getOperation, getAdvancedSearch } from './operation'
import { useUserStore } from '/@/stores/user'
import { RESTORE_WINDOW_NOT_REMIND } from '/@/constants/storage-key'

const columns = [
  {
    title: $t('窗口信息'),
    key: 'profile',
    slot: 'profile',
    style: {
      width: '0%',
      minWidth: '180px',
    }
  },
  {
    title: $t('窗口名称'),
    key: 'windowName',
    style: {
      width: '10%',
      minWidth: '160px',
    }
  },
  {
    title: $t('备注'),
    key: 'note',
    slot: 'note',
    style: {
      width: '10%',
      minWidth: '120px',
    },
  },
  {
    title: $t('标签'),
    slot: 'tags',
    style: {
      width: '10%',
      minWidth: '95px',
    }
  },
  {
    title: $t('删除记录'),
    key: 'group',
    slot: 'log',
    style: {
      width: '10%',
      minWidth: '140px',
    },
  },
  {
    title: $t('操作'),
    slot: 'actions',
    style: {
      width: '0%',
      minWidth: '100px',
      maxWidth: '100px',
    }
  },
]

const confirm = useConfirm()
const userStore = useUserStore()
const [showToast, onlyErrorToast] = useResponseToast()
const workspaceStore = useWorkspaceStore()
const [showModal] = useDialog()

const operation = getOperation()
const advancedSearchOptions = getAdvancedSearch()

const tableRef = useTemplateRef('recycleTable')

async function tableRequest(params: any) {
  // 1: 已删除
  return API.window.userGetWindowInfoListList({ ...params, isDelete: 1 })
}

function operationHandler(operate: any, data: any) {
  const datas = [].concat(data).map((item: any) => toRaw(item))
  switch (operate.name) {
    case 'restore':
      recoverHandler(datas)
      break
    case 'delete':
      deleteHandler(datas)
      break
  }
}

function onAdvancedSearch(search?: Record<string, any>) {
  const { key, value } = search || {}
  tableRef.value?.refresh({ queryKey: value && (key || 'name_remark'), queryValue: value }, true)
}

async function recoverHandler(datas: any) {
  const { userPayInfo } = userStore
  const isRemind = localStorage.getItem(RESTORE_WINDOW_NOT_REMIND) ?? false
  const recoverCount = userPayInfo.maxWindowCount - userPayInfo.useWindowCount

  if (datas.length > recoverCount) {
    showToast(1, $t('恢复的窗口数量大于剩余的窗口额度。\n(您当前仅能恢复 {0} 个窗口)', [Math.max(recoverCount, 0)]))
    return
  }

  const onConfirm = async (isRemind: boolean) => {
    const ids = datas.map((item: any) => item.id)
    const { code, msg } = await API.window.userMdfWindowInfoBatchV2Create({ ids, isDelete: false } as any)
    onlyErrorToast(code, msg)
    if (code !== 0) return

    tableRef.value?.refresh()
    if (isRemind) {
      localStorage.setItem(RESTORE_WINDOW_NOT_REMIND, 'true')
    }
  }

  if (isRemind) {
    onConfirm(true)
    return
  }

  showModal({
    header: $t('窗口恢复'),
    class: 'w-[384px]',
    slots: {
      default: ({ hideModal }) => {
        const handleConfirm = (isRemind: boolean) => {
          onConfirm(isRemind)
          hideModal()
        }
        return <RestoreReminderDialog onConfirm={handleConfirm} />
      },
      footer: undefined
    }
  })
}

async function deleteHandler(datas: any) {
  confirm.require({
    header: $t('彻底删除所选窗口'),
    message: $t('您确认要彻底删除所选窗口吗？'),
    rejectProps: {
      label: $t('取消'),
      severity: 'secondary',
      outlined: true,
    },
    acceptProps: {
      label: $t('确认'),
      severity: 'danger',
    },
    accept: async () => {
      const ids = datas.map((item: any) => item.id)
      const { code, msg } = await API.window.userDelWindowInfoRecycleCreate({ ids })
      onlyErrorToast(code, msg)
      if (code === 0) {
        tableRef.value?.refresh()
        userStore.fetchUserInfo()
        electronAPI.send('browser:batchRemove', datas.map((item: any) => item.dirId))
      }
    },
  })
}
</script>

<template>
  <!-- eslint-disable-next-line vue/no-unused-refs -->
  <RyTable ref="recycleTable" cache-key="browser-recycle-list" selection-mode="multiple" :columns="columns" :table-request="tableRequest" :operation="operation" :operation-handler="operationHandler"
    :show-gridlines="false" :show-actions="false" :show-display="false">
    <template #filter-after>
      <AdvancedSearch :options="advancedSearchOptions" :search="onAdvancedSearch" :clear="onAdvancedSearch"></AdvancedSearch>
    </template>
    <template #table-empty>
      <CustomEmpty icon="rx_illustration_bin.svg" :title="$t('回收站暂无数据')" :desc="$t('删除的窗口将展示在此处。如在回收站继续清除，窗口将无法再恢复。')" />
    </template>
    <template #profile="{ data }">
      <profileInfo :workspace-name="workspaceStore.currentWorkspace?.workspaceName?.slice(0, 3).toLocaleUpperCase()" :data="data" disabled />
    </template>
    <template #note="{ data }">
      <div class="inline-flex items-center gap-2">
        <RemarkIcon :value="data.windowRemark" disabled />
        <div :title="data.windowRemark" class="min-w-30 whitespace-pre-wrap note-content">{{ data.windowRemark }}</div>
      </div>
    </template>
    <template #tags="{ data }">
      <TagsIcon :labels="data.labelInfo" :project-id="data.projectId" disabled />
    </template>
    <template #log="{ data }">
      <div class="delete-name">{{ data.email }}</div>
      <div class="delete-time">{{ data.updateTime }}</div>
    </template>
    <template #actions="{ data }">
      <Actions :operation="operation" :show-menu="false" @quick-click="(operate) => operationHandler(operate, data)" />
    </template>
  </RyTable>
</template>

<style lang="scss" scoped>
.delete-name {
  color: var(--colors-text-text-primary, #FAFAFA);
  font-family: Inter;
  font-size: 13px;
  line-height: var(--Line-Height-text-xs, 16px);
}

.delete-time {
  margin-top: 4px;
  color: var(--colors-text-text-tertiary, #575D60);
  font-family: Inter;
  font-size: 12px;
  line-height: var(--Line-Height-text-xs, 16px);
}
</style>
