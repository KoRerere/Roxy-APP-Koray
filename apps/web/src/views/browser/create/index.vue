<script lang="ts" setup>
import SingleCreate from './modes/single-create.vue'
import BatchCreate from './modes/batch-create.vue'
import ImportCreate from './modes/import-create.vue'
import { useCreatePageShared } from './modes/useCreatePageShared'

const shared = useCreatePageShared()
const { tabs, tabsValue } = shared
</script>

<template>
  <div class="relative flex min-h-0 flex-col h-full create-page">
    <ViewsHeader show-back :divider="false" :title="$t('创建窗口')" />
    <RxTabs v-model:value="tabsValue" :tabs="tabs" only-tabs />
    <!-- v-if：避免三份 AccordionInputs 同时挂载同一份 form 状态 -->
    <SingleCreate v-if="tabsValue === 'single'" :shared="shared" />
    <BatchCreate v-else-if="tabsValue === 'multiple'" :shared="shared" />
    <ImportCreate v-else :shared="shared" />
  </div>
</template>

<style lang="scss" scoped>
:deep(.guide1.guide1-pulse-active) {
  position: relative;
  z-index: 10001;

  &::after {
    content: '';
    position: absolute;
    inset: 0;
    box-sizing: border-box;
    border-radius: inherit;
    pointer-events: none;
    border: 2px solid rgba(255, 200, 0, 0.85);
    box-shadow: 0 0 0 0 rgba(255, 200, 0, 0);
    animation: guide1-breathe 2.3s ease-in-out infinite;
  }
}

@keyframes guide1-breathe {
  0%,
  100% {
    opacity: 0.3;
    border-color: rgba(255, 200, 0, 0.45);
    box-shadow: 0 0 0 0 rgba(255, 200, 0, 0);
  }

  50% {
    opacity: 1;
    border-color: rgba(255, 200, 0, 0.95);
    box-shadow: 0 0 2px 2px rgba(255, 200, 0, 0.42);
  }
}
</style>
