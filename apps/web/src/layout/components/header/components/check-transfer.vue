<script setup lang="ts">
import { API } from '/@/api';
import { $t } from '/@/locales';
import { useWorkspaceStore } from '/@/stores/workspace'
import ProfileInfo from '/@/views/browser/list/profiles/components/profile-info.vue'

const emit = defineEmits(['close'])

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
      width: '20%',
    },
  },
  {
    title: $t('转移至'),
    key: 'transfer',
    slot: 'transfer',
    style: {
      width: '20%',
    },
  },
  {
    title: $t('来自'),
    key: 'from',
    slot: 'from',
    style: {
      width: '20%',
    },
  },
]

async function tableRequest(params: any) {
  return API.window.userGetWindowInfoListList({
    ...params,
    isDelete: 2,//窗口转移固定传 2
  })
}
</script>

<template>
  <div class="flex flex-col pa-6 pt-4 gap-5 popup">
    <div class="flex justify-between items-center">
      <span class="header">Transfer profiles</span>
      <SvgIcon class="cursor-pointer" name="base/rx_ic_delete" size="20" color="#575D60" @click="$emit('close')" />
    </div>
    <RyTable :columns="columns" :table-request="tableRequest" :show-actions="false" :show-table-header="false">
      <template #profile="{ data }">
        <ProfileInfo :workspace-name="workspaceName" :data="data" disabled />
      </template>
      <template #note="{ data }">
        <RemarkIcon :value="data.windowRemark" disabled />
      </template>
      <template #transfer="{ data }">
        <div>
          111
        </div>
      </template>
    </RyTable>
  </div>
</template>


<style lang="scss" scoped>
.popup {
  width: 960px;
}

.header {
  color: var(--Colors-text-text-primary, #111213);
  font-family: Inter;
  font-size: 16px;
  font-weight: 600;
  line-height: normal;
}
</style>