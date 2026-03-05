<script setup lang="tsx">
;
import { useOnboardingTaskStatus } from '/@/views/tutorial/hooks.ts';

const { onboardingTaskStatus, closeGuideTipsAndUpdateTaskStatus } = useOnboardingTaskStatus()
</script>

<template>
  <div class="min-w-285 flex justify-center banner">
    <div class="rx-container relative h-40 inline-flex justify-center px-12 gap-1 overflow-hidden">
      <RxButton v-if="!onboardingTaskStatus?.hideSidebarEntryStatus" icon="base/rx_ic_hidden" class="!absolute top-6 right-19 z-1" severity="secondary" variant="outlined" size="xxs"
        :label="$t('隐藏教程入口')" @click="closeGuideTipsAndUpdateTaskStatus('hideSidebarEntryStatus')" />
      <i18n-t class="banner-title" tag="div" :keypath="$t('RoxyBrowser {text}', { text: '{text}' })" scope="global">
        <template #text>
          <span class="banner-purple">{{ $t('入门指南') }}</span>
        </template>
      </i18n-t>
      <div class="banner-desc">{{ $t('完成任务 & 获取奖励') }}</div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.banner {
  background: linear-gradient(90deg, var(--pattern-tutorial-banner-bg-start) 0%, var(--pattern-tutorial-banner-bg-end) 100%);

  &-title {
    color: var(--colors-text-text-primary);
    font-family: Archivo;
    font-size: 24px;
    font-weight: 700;
    line-height: normal;
  }

  &-purple {
    color: var(--pattern-tutorial-banner-theme);
  }

  &-desc {
    color: var(--colors-text-text-secondary);
    font-size: 14px;
    line-height: normal;
  }

  &-graph1 {
    background: var(--pattern-tutorial-banner-blob1);
  }

  &-graph2 {
    background: var(--pattern-tutorial-banner-blob2);
  }

  &-graph3 {
    background: var(--pattern-tutorial-banner-blob3);
  }
}
</style>
