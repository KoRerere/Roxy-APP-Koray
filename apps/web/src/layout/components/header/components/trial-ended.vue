<script setup lang="ts">
import { useThemeStore } from '/@/stores/theme'

defineEmits<{
  (e: 'close'): void
}>()

const themeStore = useThemeStore()

const featrues = [
  $t('多账号隔离'),
  $t('稳定住宅 IP'),
  $t('全功能访问权限'),
]

const imageSrc = computed(() => {
  return themeStore.realTheme === 'light' ? 'empty/rx_illustration_time' : 'empty-dark/rx_illustration_time'
})
</script>

<template>
  <div class="flex flex-col pa-6 pt-4 gap-4 rounded-lg w-140">
    <div class="h-9 flex items-center justify-between">
      <span class=" tt-primary text-4 font-600 leading-normal">{{ $t('通知') }}</span>
      <SvgIcon class="cursor-pointer" color="var(--colors-icon-icon-secondary)" size="20" name="base/rx_ic_delete" @click="$emit('close')" />
    </div>
    <div class="flex flex-col pl-5 gap-3">
      <SvgIcon class="-ml-5" :name="imageSrc" size="120" />
      <div class="tt-secondary text-5 font-500 leading-8">
        {{ $t('您的云浏览器试用已结束') }}
      </div>
      <div class=" tt-tertiary text-3.5 leading-5.5">
        {{ $t('前往客户端继续使用，享受更快性能与全部功能权限。') }}
      </div>
      <div v-for="ft in featrues" :key="ft" class="flex items-center gap-1.5">
        <SvgIcon name="status/rx_ic_check_fill" />
        <div class="tt-primary text-3.5 font-500 leading-5">
          {{ ft }}
        </div>
      </div>
    </div>
    <div class="pt-2 flex justify-end">
      <RxButton size="lg" icon="base/rx_ic_download" :label="$t('下载 App')" @click="$emit('close')" />
    </div>
  </div>
</template>

<style lang="scss" scoped></style>
