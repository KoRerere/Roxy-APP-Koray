<script setup lang="ts">
import { $t } from '/@/locales';

const emit = defineEmits(['close', 'confirm'])

const router = useRouter()

const welcome = [
  {
    image: '/images/campaing/tutorial_welcome.png',
    title: $t('学习关于 RoxyBrowser 的一切'),
    description: $t('在此之前，让我们先进行一些简单的新手教程，助您快速掌握使用技巧！'),
    btnText: $t('观看教程'),
    click: toUserGuide
  },
  {
    image: '/images/campaing/tutorial_resource.png',
    title: $t('RoxyBrowser 功能调整通知'),
    description: $t('由于技术架构升级，Roxy资源模块服务正式结束。RoxyBrowser 团队提供了对流媒体特别优化的代理服务，您可以前往代理中心进行购买与使用。'),
  }
]

function toUserGuide() {
  router.push({ name: 'tutorial' })
  onClose()
}

function onClose() {
  emit('close')
}
</script>

<template>
  <div class="w-160 inline-flex flex-col pa-6 pt-4 gap-5">
    <div class="flex justify-between items-center">
      <span class="header">{{ $t('欢迎加入') }}</span>
      <SvgIcon class="cursor-pointer" name="base/rx_ic_delete" size="20" color="var(--colors-icon-icon-secondary)" @click="onClose" />
    </div>
    <div class="flex flex-col gap-6" v-for="(item, index) in welcome" :key="item.title">
      <RxDivider v-if="index !== 0" line-only></RxDivider>
      <div class="flex items-start gap-6">
        <img class="block w-64 object-cover rounded-lg" :src="item.image">
        <div class="flex flex-col justify-between py-2">
          <div class="flex flex-col gap-1.5">
            <div v-if="item.title" class="title">{{ item.title }}</div>
            <div v-if="item.description" class="desc">{{ item.description }}</div>
          </div>
          <RxButton v-if="item.btnText" class="self-end" severity="secondary" variant="outlined" size="md" :label="item.btnText" @click="item.click" />
        </div>
      </div>
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

.title {
  color: var(--colors-text-text-primary);
  font-family: Inter;
  font-size: 14px;
  font-style: normal;
  font-weight: 700;
  line-height: 16px;
}

.desc {
  color: var(--colors-text-text-secondary);
  font-family: Inter;
  font-size: 12px;
  font-style: normal;
  font-weight: 400;
  line-height: 18px;
  /* 150% */
}
</style>
