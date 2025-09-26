<script setup lang="ts">
// import GuideModal from '/@/views/tutorial/components/guide-modal.vue';
import { $t } from '/@/locales';
// import { useDialog } from '/@/hooks/useDialog'

const emit = defineEmits(['close', 'confirm'])

const router = useRouter()
// const [showModal] = useDialog()

function onSkip() {
  // showModal({
  //   showHeader: false,
  //   modal: true,
  //   blockScroll: true,
  //   slots: {
  //     container: ({ hideModal }) => h(GuideModal, {
  //       title: $t('教程提示'),
  //       desc: $t('当您对 RoxyBrowser 的产品功能不熟悉或希望学习更多技巧时，可以随时通过右下方蓝色按钮找到"教程"入口。'),
  //       video: "/video/tour-hide-guide.mp4",
  //       onClose: hideModal,
  //       onConfirm: hideModal
  //     })
  //   }
  // })
  emit('close')
}

function toUserGuide() {
  router.push({ name: 'tutorial' })
  emit('close')
}
</script>

<template>
  <div class="w-120 inline-flex flex-col pa-6 pt-4 gap-4">
    <div class="flex justify-between items-center">
      <span class="header">{{ $t('欢迎加入') }}</span>
      <SvgIcon class="cursor-pointer" name="base/rx_ic_delete" size="20" color="var(--colors-icon-icon-secondary)" @click="onSkip" />
    </div>
    <img class="block w-full rounded-lg" src="/public/images/welcome-banner.png">
    <div class="flex flex-col gap-6">
      <div class="desc">{{ $t('欢迎来到 RoxyBrowser，准备好开始您的隐私之旅了吗？') }}</div>
      <div class="desc">{{ $t('在此之前，让我们先进行一些简单的新手教程，助您快速掌握使用技巧！') }}</div>
    </div>
    <div class="flex justify-between items-center">
      <RxButton severity="secondary" variant="outlined" size="md" :label="$t('跳过')" @click="onSkip" />
      <RxButton size="md" icon="base/rx_ic_books" :label="$t('现在开始')" @click="toUserGuide" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.header {
  color: var(--colors-text-text-primary);
  font-size: 16px;
  font-weight: 600;
  line-height: normal;
}

.desc {
  color: var(--colors-text-text-primary);
  font-size: 14px;
  line-height: 21px;
}
</style>
