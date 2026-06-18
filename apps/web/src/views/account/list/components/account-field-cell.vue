<script setup lang="ts">
import { RxSvgIcon } from '/@/components/rx-icon/'

defineProps<{
  value?: string
  masked?: boolean
  showCopy?: boolean
  showEdit?: boolean
}>()

const emit = defineEmits<{
  copy: []
  edit: []
}>()

function displayValue(value?: string, masked?: boolean) {
  if (!value)
    return '--'
  if (masked)
    return '••••••••'
  return value
}
</script>

<template>
  <div class="account-field-cell">
    <span class="account-field-cell__value" :title="masked ? undefined : value">{{ displayValue(value, masked) }}</span>
    <div v-if="showCopy || showEdit" class="account-field-cell__actions row-hover-action">
      <RxButton v-if="showCopy && value" v-tooltip.top="{ value: $t('复制'), showDelay: 500 }" class="shrink-0" text severity="secondary" size="xxs"
                icon="base/rx_ic_copy" @click.stop="emit('copy')"
      />
      <RxButton v-if="showEdit" v-tooltip.top="{ value: $t('编辑'), showDelay: 500 }" class="shrink-0" text severity="secondary" size="xxs"
                icon="base/rx_ic_edit" @click.stop="emit('edit')"
      />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.account-field-cell {
  display: flex;
  align-items: center;
  gap: 4px;
  min-height: 24px;
  width: 100%;

  &__value {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 12px;
    line-height: 16px;
    color: var(--colors-text-text-primary);
    font-weight: 500;
  }

  &__actions {
    display: flex;
    align-items: center;
    gap: 2px;
    flex-shrink: 0;
    opacity: 0;
    transition: opacity 0.15s ease;
  }
}
</style>
