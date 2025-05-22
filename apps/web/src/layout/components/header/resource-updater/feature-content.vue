<script setup lang="ts">
import type { ResourceUpdateMessage } from '@roxy/electron-preload'

const props = defineProps<{
  updaterItem: ResourceUpdateMessage
  featureTitleList: any[]
}>()

const featureList = computed(() => {
  return props.featureTitleList.filter(m => props.updaterItem.upgradeContent?.[m.key])
})
</script>

<template>
  <div class="updater-content">
    <template v-for="n in featureList" :key="n.key">
      <div class="feature-item">
        <div class="feature-title">
          {{ n.title }}
        </div>
        <ul class="feature-content" v-html="updaterItem.upgradeContent[n.key]" />
      </div>
    </template>
    <slot name="footer" />
  </div>
</template>

<style lang="scss" scoped>
.updater-content {
  display: flex;
  padding: 0px 16px 0px 54px;
  flex-direction: column;
  align-items: flex-start;
  gap: var(--spacing-2xl, 16px);
  align-self: stretch;
}

.feature-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 6px;
  align-self: stretch;

  .feature-title {
    color: var(--colors-text-text-primary, #fafafa);
    font-family: Inter;
    font-size: 14px;
    font-style: normal;
    font-weight: 600;
    line-height: normal;
  }

  .feature-content {
    margin-top: 0;
    padding-left: 16px;
    color: var(--colors-text-text-secondary, #b2b6b8);
    font-family: Inter;
    font-size: 12px;
    font-style: normal;
    font-weight: 400;
    line-height: normal;

    :deep(li) {
      margin-bottom: 6px;

      &:last-of-type {
        margin-bottom: 0;
      }
    }
  }
}
</style>
