<script setup lang="ts">
;

const emit = defineEmits(['close', 'confirm'])

function onClose() {
  emit('close')
}
</script>

<template>
  <div class="w-96 flex flex-col pa-6 gap-5">
    <img class="block rounded-lg" src="/images/campaing/banner.png">
    <div class="title">{{ $t('RoxyBrowser 功能调整通知') }}</div>
    <div class="desc">
      <div>{{ $t('由于技术架构升级，Roxy资源模块服务正式结束。') }}</div>
      <br />
      <div>{{ $t('现在，您可以通过"自建空间"功能，获得更个性化和安全的协作体验。') }}</div>
      <br />
      <div>{{ $t('RoxyBrowser 团队提供了对流媒体特别优化的代理 IP 服务，您可以前往代理 IP 中心进行购买与使用。') }}</div>
      <br />
      <div>{{ $t('再次感谢大家一直以来的支持！') }}</div>
      <br />
      <div>{{ $t('RoxyBrowser 团队') }}</div>
      <div>2025/11/14</div>
    </div>
    <RxButton size="lg" :label="$t('关闭')" @click="onClose" />
  </div>
</template>

<style lang="scss" scoped>
.title {
  color: var(--colors-text-text-primary);
  font-size: 14px;
  font-weight: 700;
  line-height: 20px;
}

.desc {
  color: var(--colors-text-text-secondary);
  font-size: 12px;
  line-height: 1.5;
}
</style>
