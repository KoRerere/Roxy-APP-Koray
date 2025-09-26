<script setup lang="tsx">
import GuideModal from '/@/views/tutorial/components/guide-modal.vue';
import { $t } from '/@/locales';
import { useDialog } from '/@/hooks/useDialog'
import { useUserStore } from "/@/stores/user";
import { useOnboardingTaskStatus } from '/@/views/tutorial/hooks.ts';

const [showModal] = useDialog()
const { updateOnboardingTaskStatus } = useOnboardingTaskStatus()
const { userPayInfo } = storeToRefs(useUserStore())

function onHideTips() {
  showModal({
    showHeader: false,
    modal: true,
    blockScroll: true,
    slots: {
      container: ({ hideModal }) => h(GuideModal, {
        title: $t('教程提示'),
        desc: $t('当您对 RoxyBrowser 的产品功能不熟悉或希望学习更多技巧时，可以随时通过右下方蓝色按钮找到"教程"入口。'),
        video: "/video/tour-hide-guide.mp4",
        onClose: hideModal,
        onConfirm: () => {
          hideModal()
          updateOnboardingTaskStatus({ hideSidebarEntryStatus: true })
        }
      })
    }
  })
}
</script>

<template>
  <div class="flex justify-center banner">
    <div class="rx-container relative w-full h-40 inline-flex justify-center px-12 gap-1 overflow-hidden">
      <RxButton v-if="!userPayInfo.onboardingTaskStatus?.hideSidebarEntryStatus" icon="base/rx_ic_hidden" class="!absolute top-6 right-19 z-1" severity="secondary" variant="outlined" size="xxs" :label="$t('隐藏教程入口')"
        @click="onHideTips" />
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
