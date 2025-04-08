<script setup lang="tsx">
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
      width: '40%',
    },
  },
  {
    title: $t('备注'),
    key: 'note',
    slot: 'note',
    style: {
      width: '30%',
    },
  },
  {
    title: $t('转移至'),
    key: 'transfer',
    slot: 'transfer',
    style: {
      width: '30%',
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
      <ProfileInfo :workspace-name="workspaceName" :data="data" disabled />
    </template>
    <template #note="{ data }">
      <RemarkIcon :value="data.windowRemark" disabled />
    </template>
    <template #transfer="{ data }">
      <div class="flex items-center">
        <RxAvatar :name="data.workspacePicture" :size="36" color="orange" :font-size="16" />
        <div class="">{{ data.workspaceName }}</div>
        <div class="">ID: {{ data.workspaceNo }}</div>
      </div>
    </template>
  </RyTable>
</template>

<style lang="scss" scoped></style>
