<script setup lang="ts">
defineProps({
  title: String,
  desc: String,
})
</script>

<template>
  <div class="empty-content">
    <div class="empty-icon" />
    <div class="empty-info">
      <div class="empty-info-title">
        {{ title }}
      </div>
      <div class="empty-info-desc" v-html="desc" />
      <slot name="extra" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.empty-content {
  display: flex;
  flex-direction: column;
  margin: 0 auto;
  gap: var(--spacing-xl, 12px);
  width: var(--width-xs, 384px);
}

.empty-icon {
  width: 90px;
  height: 90px;
  padding: 13px;
  background-color: orange;
}

.empty-info {
  display: flex;
  padding-left: var(--spacing-3xl, 20px);
  flex-direction: column;
  align-items: flex-start;
  gap: var(--spacing-xl, 12px);
  align-self: stretch;

  &-title {
    color: var(--Colors-Text-text-secondary, #575d61);
    font-family: Inter;
    font-size: 16px;
    font-weight: 500;
    line-height: normal;
  }

  &-desc {
    color: var(--Colors-Text-text-tertiary, #7c8387);
    font-family: Inter;
    font-size: 12px;
    line-height: 20px;
  }
}
</style>
