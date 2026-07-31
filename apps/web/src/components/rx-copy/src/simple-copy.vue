<script setup lang="ts">
import { copyText } from '/@/utils';
import { useResponseToast } from '/@/hooks/useResponseToast'

const {
  text,
  iconSize = 16,
  iconColor = 'var(--colors-icon-icon-secondary)' } = defineProps<{
    text: string
    iconSize?: number
    iconColor?: string
  }>()


const [showToast] = useResponseToast()


function handleCopy() {
  showToast(0, $t('复制成功'))
  copyText(text)
}
</script>

<template>
  <div class="flex items-center gap-1.5 tt-primary text-3.25 leading-4.5">
    <span>{{ text }}</span>
    <SvgIcon class="cursor-pointer" name="base/rx_ic_copy" :size="iconSize" :color="iconColor" @click="handleCopy" />
  </div>
</template>

<style scoped></style>
