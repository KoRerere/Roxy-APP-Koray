<script setup lang="ts">
import RxButton from '/@/components/rx-button'
import RyTable from '/@/components/ry-table'
import type { ProxyCreateLabels } from '../proxy-create-mode'

defineProps<{
  title: string
  labels: ProxyCreateLabels
  columns: any[]
  dataList: any[]
  isAllExist: boolean
  okText: string
}>()

const emit = defineEmits<{
  close: []
  cancel: []
  confirm: []
}>()
</script>

<template>
  <div class="duplicate-proxies-modal !w-[960px] flex flex-col gap-6 pa-6 pt-4 rounded-2">
    <div class="duplicate-proxies-modal__header h-9 flex items-center justify-between">
      <div class="text-4 font-600 leading-normal text-[var(--colors-text-text-primary)]">
        {{ title }}
      </div>
      <SvgIcon class="cursor-pointer" name="base/rx_ic_delete" size="20" color="var(--colors-icon-icon-secondary)" @click="emit('close')" />
    </div>
    <div class="flex flex-col gap-6">
      <p class="text-[var(--colors-text-text-error)] text-14px font-400 leading-14px">
        {{ labels.duplicateDesc }}
      </p>
      <RyTable :columns="columns" :data-list="dataList" :paginator="false" :show-table-header="false" :show-actions="false" />
      <div class="flex gap-10px justify-end">
        <RxButton v-if="!isAllExist" severity="secondary" outlined :label="$t('取消')" @click="emit('cancel')" />
        <RxButton :label="okText" @click="emit('confirm')" />
      </div>
    </div>
  </div>
</template>
