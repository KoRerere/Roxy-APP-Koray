<!-- eslint-disable ts/ban-ts-comment -->
<script setup lang="ts">
defineProps({
  title: {
    type: String,
    default: 'Drawer title',
  },
  footer: {
    type: Boolean,
    default: true,
  },
})

defineEmits(['confirm', 'close'])
</script>

<template>
  <div class="w-full h-full drawer">
    <div class="flex justify-between items-center drawer-header">
      <span>{{ title }}</span>
      <span class="cursor-pointer" @click="$emit('close')">x</span>
    </div>
    <div class="drawer-content">
      <slot />
    </div>
    <div v-if="footer" class="drawer-footer">
      <slot name="footer">
        <slot name="footer-left" />
        <RxButton label="Confirm" severity="info" @click="$emit('confirm')" />
      </slot>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.drawer {
  display: flex;
  flex-direction: column;

  &-header {
    padding: var(--spacing-lg, 8px) var(--spacing-2xl, 16px);
    border-bottom: 0.5px solid var(--Color-neutrals-300, #c7cdd1);
    color: var(--Colors-Text-text-primary, #171c1f);
    font-family: Inter;
    font-size: 14px;
    font-style: normal;
    font-weight: 600;
    line-height: var(--Line-Height-text-sm, 18px);
    height: 40px;
  }

  &-content {
    padding: 0 var(--spacing-2xl, 16px);
    height: calc(100% - 100px);
  }

  &-footer {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: var(--spacing-xl, 12px);
    padding: var(--spacing-2xl, 16px) var(--spacing-2xl, 16px) var(--spacing-xl, 12px) var(--spacing-2xl, 16px);
    height: 60px;
  }
}
</style>
