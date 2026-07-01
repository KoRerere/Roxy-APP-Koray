<script setup lang="ts">
import { useResponseToast } from '/@/hooks/useResponseToast'
import { copyText } from '/@/utils/basic'

const { value, masked, showMasked } = defineProps<{
  value?: string
  masked?: boolean
  showCopy?: boolean
  showEdit?: boolean
  showMasked?: boolean
}>()

const emit = defineEmits<{
  edit: []
  toggleMasked: []
}>()

const [showToast] = useResponseToast()

function displayValue(value?: string, masked?: boolean) {
  if (!value)
    return '--'
  if (masked)
    return '••••••••'
  return value
}

function onCopy() {
  if (!value || masked)
    return
  copyText(value)
  showToast(0, $t('已复制'))
}

function toggleMasked() {
  if (!showMasked)
    return
  emit('toggleMasked')
}
</script>

<template>
  <div class="w-full h-full min-h-6 flex items-center gap-1 select-none">
    <span class="min-w-0 tt-primary text-3 leading-4 font-500 truncate" :title="masked ? undefined : value" @click.stop="toggleMasked">{{ displayValue(value, masked) }}</span>
    <div v-if="showCopy || showEdit" class="cell_actions row-hover-action">
      <RxButton v-if="showCopy && value && !masked" v-tooltip.top="{ value: $t('复制'), showDelay: 500 }" class="shrink-0" text severity="secondary" size="xxs" icon="base/rx_ic_copy"
                @click.stop="onCopy"
      />
      <RxButton v-if="showEdit && !masked" v-tooltip.top="{ value: $t('编辑'), showDelay: 500 }" class="shrink-0" text severity="secondary" size="xxs" icon="base/rx_ic_edit"
                @click.stop="emit('edit')"
      />
      <RxButton v-if="showMasked" v-tooltip.top="{ value: masked ? $t('显示') : $t('隐藏'), showDelay: 500 }" class="shrink-0" text severity="secondary" size="xxs"
                :icon="masked ? 'base/rx_ic_hidden' : 'base/rx_ic_eye'" @click.stop="toggleMasked"
      />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.cell_actions {
  display: flex;
  align-items: center;
  gap: 2px;
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 0.15s ease;
}
</style>
