<script setup lang="ts">
import ProfileInfo from '/@/views/browser/list/profiles/components/profile-info/index.vue'
import { API } from '/@/api';
;

const { transferTaskId } = defineProps<{
  transferTaskId: number
}>()

defineEmits(['close'])

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
    key: 'name',
    style: {
      width: '10%',
      minWidth: '200px',
    }
  },
  {
    title: $t('备注'),
    key: 'remark',
    slot: 'remark',
  },
  {
    title: $t('投送时间'),
    key: 'createTime',
  }
]

function tableRequest(params: any) {
  return API.window.userGetTransferTaskDetailsList({ ...params, transferTaskId })
}
</script>

<template>
  <div class="flex flex-col pa-6 pt-4 gap-5 w-240">
    <div class="flex justify-between items-center">
      <span class="header">{{ $t('投送详情') }}</span>
      <SvgIcon class="cursor-pointer" name="base/rx_ic_delete" size="20" color="var(--colors-icon-icon-secondary)" @click="$emit('close')" />
    </div>
    <div class="h-120">
      <RyTable :columns="columns" :table-request="tableRequest" :show-actions="false" :show-table-header="false">
        <template #profile="{ data }">
          <ProfileInfo :show-sort="false" :data="data" readonly />
        </template>
        <template #remark="{ data }">
          <RemarkIcon :value="data.remark" disabled />
        </template>
      </RyTable>
    </div>
  </div>
</template>


<style lang="scss" scoped>
.header {
  color: var(--colors-text-text-primary);
  font-size: 16px;
  font-weight: 600;
  line-height: normal;
}
</style>
