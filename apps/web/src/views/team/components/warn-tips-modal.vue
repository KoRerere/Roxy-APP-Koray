<script setup lang="ts">
import { API } from '/@/api'

const emit = defineEmits<{
  (e: 'close'): void
}>()

async function onSetPermissions(allowViewerEditorCostCenter: number) {
  await API.team.userSetTeamCostCenterViewerEditorAllowCreate({ allowViewerEditorCostCenter })
  emit('close')
}
</script>

<template>
  <div class="w-96 flex flex-col gap-3 pa-6 pt-4 rounded-2">
    <div class="h-9 flex items-center justify-between">
      <div class="tt-primary text-4 font-600 leading-normal">
        {{ $t('费用中心权限提醒') }}
      </div>
      <SvgIcon class="cursor-pointer" name="base/rx_ic_delete" size="20" color="var(--colors-icon-icon-secondary)" @click="emit('close')" />
    </div>
    <div class="mt-1 tt-primary text-3.5 leading-5 mb-5">
      {{ $t('是否允许其他团队成员访问“费用中心”（充值/消费/查账等）？') }}
    </div>
    <RxButton :label="$t('允许')" size="lg" @click="onSetPermissions(1)" />
    <RxButton :label="$t('不允许')" size="lg" outlined severity="secondary" @click="onSetPermissions(0)" />
  </div>
</template>

<style lang="scss" scoped></style>
