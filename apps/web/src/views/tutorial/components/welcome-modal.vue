<script setup lang="ts">
import { $t } from '/@/locales';

const emit = defineEmits(['close', 'confirm'])

const router = useRouter()

function toUserGuide() {
  router.push({ name: 'tutorial' })
  onClose()
}

function onClose() {
  emit('close')
}
</script>

<template>
  <div class="w-120 inline-flex flex-col pa-6 pt-4 gap-4">
    <div class="flex justify-between items-center">
      <span class="header">{{ $t('欢迎加入') }}</span>
      <SvgIcon class="cursor-pointer" name="base/rx_ic_delete" size="20" color="var(--colors-icon-icon-secondary)" @click="onClose" />
    </div>
    <img class="block w-full rounded-lg" src="/images/welcome-banner.png">
    <div class="flex flex-col gap-6">
      <div class="desc">{{ $t('欢迎来到 RoxyBrowser，准备好开始您的隐私之旅了吗？') }}</div>
      <div class="desc">{{ $t('在此之前，让我们先进行一些简单的新手教程，助您快速掌握使用技巧！') }}</div>
    </div>
    <div class="flex justify-between items-center">
      <RxButton severity="secondary" variant="outlined" size="md" :label="$t('跳过')" @click="onClose" />
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
