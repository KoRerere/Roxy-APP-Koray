<script setup lang="ts">
interface Props {
  title: string
}

defineOptions({
  inheritAttrs: false,
})

defineProps<Props>()
</script>

<template>
  <Drawer v-bind="$attrs" position="right" :pt="{ mask: classes.mask, root: classes.content }">
    <template #container="slotProps">
      <div :class="classes.header">
        <div>{{ title }}</div>
        <RxButton text severity="secondary" size="xxs" icon="base/rx_ic_delete" @click="slotProps.closeCallback" />
      </div>
      <div :class="classes.body">
        <slot v-bind="slotProps" />
      </div>
    </template>
  </Drawer>
</template>

<style lang="scss" module="classes">
.mask {
  padding: var(--spacing-xl, 12px);
}

.content {
  width: auto !important;
  border-radius: var(--radius-lg, 8px);
  border: 0.5px solid var(--Colors-Border-border-strong, #a3a9ad);
  background: var(--Colors-Background-bg-body, #fff);
  box-shadow:
    0px 1px 1px 0px rgba(0, 0, 0, 0.04),
    0px 2px 8px 0px rgba(0, 0, 0, 0.04),
    0px 3px 17px 0px rgba(0, 0, 0, 0.04),
    0px 4px 30px 0px rgba(0, 0, 0, 0.12);
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  align-self: stretch;
  padding: var(--spacing-lg, 8px) var(--spacing-xl, 12px) var(--spacing-lg, 8px) var(--spacing-2xl, 16px);
  gap: var(--spacing-xl, 12px);
  border-bottom: 0.5px solid var(--Color-neutrals-300, #c7cdd1);

  color: var(--Colors-Text-text-primary, #171c1f);
  font-family: Inter;
  font-size: 14px;
  font-weight: 600;
  line-height: var(--Line-Height-text-sm, 18px);
}

.body {
  flex: 1;
  overflow: hidden;
}
</style>
