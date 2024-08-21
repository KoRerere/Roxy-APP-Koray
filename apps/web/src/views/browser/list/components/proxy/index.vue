<!-- eslint-disable ts/ban-ts-comment -->
<script setup lang="ts">
import ryButton from '/@/components/ry-button'

// @ts-ignore
import list from './list.vue'
// @ts-ignore
import create from './create.vue'

defineProps({
  closeDrawer: {
    type: Function,
    default: () => () => { },
  },
})
</script>

<template>
  <div class="w-full h-full drawer">
    <div class="flex justify-between items-center drawer-title">
      <span>选择代理</span>
      <span class="cursor-pointer" @click="() => closeDrawer()">x</span>
    </div>
    <div class="drawer-content">
      <!-- <list /> -->
      <create />
    </div>
    <div class="flex justify-end drawer-footer">
      <ry-button label="Save selected" severity="info" />
      <ry-button label="Test Proxy" severity="secondary" outlined />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.drawer {
  display: flex;
  flex-direction: column;

  &-title {
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
    flex: auto;
    padding: var(--spacing-2xl, 16px);
  }

  &-footer {
    display: flex;
    flex-direction: row-reverse;
    padding: var(--spacing-2xl, 16px) var(--spacing-2xl, 16px) var(--spacing-3xl, 20px) var(--spacing-2xl, 16px);
    justify-content: space-between;
    align-items: center;
  }
}
</style>
