<script setup lang="tsx">
import { format } from 'date-fns'
import { API } from '/@/api'
import { $t } from '/@/locales'
import { useWorkspaceStore } from '/@/stores/workspace'
import ProfileInfo from '/@/views/browser/list/profiles/components/profile-info.vue'

const workspaceStore = useWorkspaceStore()

const workspaceName = computed(() => workspaceStore.currentWorkspace?.workspaceName!.slice(0, 3).toLocaleUpperCase()!)

const columns = [
  {
    title: $t('窗口信息'),
    key: 'profile',
    slot: 'profile',
    style: {
      width: '30%',
    },
  },
  {
    title: $t('备注'),
    key: 'note',
    slot: 'note',
    style: {
      width: '10%',
    },
  },
  {
    title: $t('转移至'),
    key: 'transfer',
    slot: 'transfer',
    style: {
      width: '40%',
    },
  },
  ,
  {
    title: $t('转移发起时间'),
    key: 'createTime',
    getText: (row: any) => row.createTime ? format(new Date(row.createTime), 'yyyy/MM/dd HH:mm:ss') : '--',
    style: {
      width: '20%',
    },
  },
]

async function tableRequest(params: any) {
  return API.window.userGetTransferReceiveWindowListList(params)
}
</script>

<template>
  <!-- eslint-disable-next-line vue/no-unused-refs -->
  <RyTable cache-key="browser-transfer-list" :columns="columns" :table-request="tableRequest" :show-gridlines="false" :show-actions="false" :show-table-header="false">
    <template #profile="{ data }">
      <ProfileInfo :workspace-name="workspaceName" :data="data" readonly />
    </template>
    <template #note="{ data }">
      <RemarkIcon :value="data.windowRemark" disabled />
    </template>
    <template #transfer="{ data }">
      <div class="flex items-center">
        <Avatar :label="data.workspacePicture || data.workspaceName?.slice(0, 2)" class="space-icon" :class="{ '!bg-black': !data.workspacePicture }"
          :pt="{ label: data.workspacePicture ? 'text-[12px]' : 'text-[14px]' }" />
        <div class="ml-3 space-name">{{ data.workspaceName }}</div>
        <div class="ml-1 space-id">ID: {{ data.workspaceNo }}</div>
      </div>
    </template>
  </RyTable>
</template>

<style lang="scss" scoped>
.space-icon {
  width: 24px;
  height: 24px;
  color: #fff;
  text-align: center;
  font-family: 'JetBrains Mono';
  font-size: 12px !important;
  font-style: normal;
  font-weight: 700;
  line-height: 12px;
  letter-spacing: -0.4px;
  text-transform: uppercase;
}

.space-name {
  color: var(--Colors-text-text-primary, #111213);
  font-size: 14px;
  font-weight: 500;
  line-height: var(--Line-Height-text-xs, 16px);
}

.space-id {
  color: var(--Colors-text-text-tertiary, #575D60);
  font-family: "JetBrains Mono";
  font-size: 12px;
  line-height: var(--Line-Height-text-xs, 16px);
}
</style>
