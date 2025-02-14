<script setup lang="ts">
import { useConfirm } from 'primevue/useconfirm'
import { useTemplateRef } from 'vue'
import { API } from '/@/api'
import useColumns from '/@/hooks/useColumns'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { $t } from '/@/locales'
import { useWorkspaceStore } from '/@/stores/workspace'
import profileInfo from '/@/views/browser/list/profiles/components/profile-info.vue'
import TagsIcon from '/@/views/browser/list/profiles/components/tags-icon.vue'
import { getColumnsConfig } from './columns'
import { getOperation } from './operation'
import { useUserStore } from '/@/stores/user'

const confirm = useConfirm()

const [columns] = useColumns(getColumnsConfig())

const userStore = useUserStore()
const [showToast] = useResponseToast()
const workspaceStore = useWorkspaceStore()

const operation = getOperation()

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

async function recoverHandler(datas: any) {
  confirm.require({
    header: $t('恢复所选窗口'),
    message: $t('您确认要恢复所选窗口吗？'),
    rejectProps: {
      label: $t('取消'),
      severity: 'secondary',
      outlined: true,
    },
    acceptProps: {
      label: $t('确认'),
      severity: 'info',
    },
    accept: async () => {
      const ids = datas.map((item: any) => item.id)
      await API.window.userMdfWindowInfoBatchV2Create({ ids, isDelete: false } as any)
      tableRef.value?.refresh()
    },
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
      const { code, msg } = await API.window.userDelWindowInfoCreate({ ids })
      showToast(code, msg)
      tableRef.value?.refresh()
      userStore.fetchUserInfo()
      if (code === 0) {
        electronAPI.send('browser:batchRemove', datas.map((item: any) => item.dirId))
      }
    },
  })
}
</script>

<template>
  <!-- eslint-disable-next-line vue/no-unused-refs -->
  <RyTable ref="recycleTable" cache-key="browser-recycle-list" selection-mode="multiple" :columns="columns"
    :table-request="tableRequest" :operation="operation" :operation-handler="operationHandler" :show-gridlines="false"
    :show-actions="false" :show-table-header="false">
    <template #table-empty>
      <CustomEmpty icon="rx_illustration_bin.svg" :title="$t('回收站暂无数据')"
        :desc="$t('删除的窗口将展示在此处。如在回收站继续清除，窗口将无法再恢复。')" />
    </template>
    <template #profile="{ data }">
      <profileInfo :workspace-name="workspaceStore.currentWorkspace?.workspaceName?.slice(0, 3).toLocaleUpperCase()"
        :data="data" disabled />
    </template>
    <template #tags="{ data }">
      <TagsIcon :labels="data.labelInfo" :project-id="data.projectId" disabled />
    </template>
    <template #log="{ data }">
      <div class="delete-name">
        {{ data.email }}
      </div>
      <div class="delete-time">
        {{ data.updateTime }}
      </div>
    </template>
    <template #actions="{ data }">
      <div class="flex gap-2">
        <!-- {{ $t('恢复窗口') }} -->
        <RemarkIcon :value="data.windowRemark" disabled />
        <Actions :operation="operation" :show-menu="false"
          @quick-click="(operate) => operationHandler(operate, data)" />
      </div>
    </template>
  </RyTable>
</template>

<style lang="scss" scoped>
.delete-name {
  color: #000;
  font-family: Inter;
  font-size: 13px;
  line-height: var(--Line-Height-text-xs, 16px);
}

.delete-time {
  margin-top: 4px;
  color: var(--Colors-Text-text-tertiary, #7c8387);
  font-family: Inter;
  font-size: 12px;
  line-height: var(--Line-Height-text-xs, 16px);
}
</style>
