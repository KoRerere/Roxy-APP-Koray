<script setup lang="ts">
import { useSimpleLocale } from '/@/stores/locale'

defineEmits(['close'])
const { getVideoSource } = useSimpleLocale()
</script>

<template>
  <div class="flex flex-col pa-6 pt-4 gap-6 popup">
    <div class="flex justify-between items-center">
      <span class="header">{{ $t('如何获取团队 ID') }}</span>
      <SvgIcon class="cursor-pointer" name="base/rx_ic_delete" size="20" color="var(--colors-icon-icon-note)" @click="$emit('close')" />
    </div>
    <video class="block w-full rounded-md" autoplay muted loop playsinline>
      <source :src="getVideoSource('copy_workspace_id.mp4')" type="video/webm">
    </video>
    <div class="description">
      {{ $t('你可以在 设置中心 → 软件设置 中找到快速模板的配置和修改') }}
    </div>
    <RxButton class="self-end" size="md" :label="$t('了解')" @click="$emit('close')" />
  </div>
</template>

<style lang="scss" scoped>
.popup {
  width: 560px;
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
</style>
