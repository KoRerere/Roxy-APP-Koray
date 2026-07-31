<script setup lang="tsx">

import { useProfileEntityLabels } from '/@/composables/useProfileEntityLabels'
import { emitter } from '/@/utils/eventBus'
import { useUserStore } from '/@/stores/user';

const { userConfig } = storeToRefs(useUserStore())
const profileLabels = useProfileEntityLabels()

const emit = defineEmits(['close'])

async function openSettings() {
  emitter.emit('openSettings', { settingsKey: 'preferences', anchorPoint: 'diskSettings' })
  close()
}

function close() {
  emit('close')
}
</script>

<template>
  <div class="flex flex-col pa-6 pt-4 gap-4 select-none popup">
    <div class="relative flex items-center h-9">
      <span class="header">{{ $t('磁盘空间不足') }}</span>
      <SvgIcon class="absolute right-0 cursor-pointer" size="20" name="base/rx_ic_delete" color="var(--colors-icon-icon-secondary)" @click="close" />
    </div>
    <i18n-t class="help" tag="div" :keypath="profileLabels.cannotOpenDisk" scope="global">
      <template #bold>
        <span class="help-bold">{{ userConfig.diskLimit }}GB</span>
      </template>
    </i18n-t>
    <div class="flex justify-end gap-2">
      <RxButton outlined severity="secondary" size="md" :label="$t('取消')" @click="close"></RxButton>
      <RxButton size="md" :label="$t('打开设置')" @click="openSettings"></RxButton>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.popup {
  width: 384px;
}

.header {
  color: var(--colors-text-text-primary);
  font-size: 16px;
  font-weight: 600;
  line-height: normal;
}

.help {
  color: var(--colors-text-text-secondary);
  font-size: 14px;
  line-height: 21px;

  &-bold {
    color: var(--colors-text-text-primary);
    font-weight: 700;
  }
}
</style>
