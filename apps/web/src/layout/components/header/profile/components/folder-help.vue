<script setup lang="ts">
import { useProfileEntityLabels } from '/@/composables/useProfileEntityLabels'

defineEmits(['close', 'confirm'])

const profileLabels = useProfileEntityLabels()
const isAgree = ref(false)
</script>

<template>
  <div class="flex flex-col pa-6 pt-4 gap-6 popup">
    <div class="flex justify-between items-center">
      <span class="header">{{ $t('迁移当前缓存文件') }}</span>
      <SvgIcon class="cursor-pointer" name="base/rx_ic_delete" size="20" color="var(--colors-icon-icon-note)" @click="$emit('close')" />
    </div>
    <div class="flex flex-col gap-3">
      <div class="description">
        {{ profileLabels.existingEntityCachePathNote }}
      </div>
      <i18n-t class="description" tag="div" :keypath="profileLabels.avoidCacheLossKeypath" scope="global">
        <template #bold>
          <span class="font-bold">{{ profileLabels.migrateCacheBeforeLaunch }}</span>
        </template>
      </i18n-t>
    </div>
    <div class="flex items-center gap-2.5">
      <RxCheckbox v-model="isAgree" input-id="wrap" binary />
      <label for="wrap" class="tip">{{ profileLabels.migrateCacheAcknowledge }}</label>
    </div>

    <div class="flex justify-end items-center gap-2.5">
      <RxButton severity="danger" :disabled="!isAgree" size="md" :label="$t('打开当前缓存路径 & 选择新路径')" @click="$emit('confirm')" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.popup {
  width: 540px;
}

.header {
  color: var(--colors-text-text-primary);
  font-size: 16px;
  font-weight: 600;
  line-height: normal;
}

.description {
  color: var(--colors-text-text-primary);
  font-size: 14px;
  line-height: 22.4px;
}

.tip {
  color: var(--colors-text-text-primary);
  font-size: 14px;
  line-height: 20px;
}
</style>
