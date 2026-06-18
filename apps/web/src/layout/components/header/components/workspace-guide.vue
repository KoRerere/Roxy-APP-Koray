<script setup lang="ts">
const props = defineProps({
  hideFn: Function,
})
</script>

<template>
  <div class="workspace-guide">
    <img src="/workspace_banner.png" class="w-full">
    <div class="title">
      {{ $t('Roxy 团队说明') }}
    </div>
    <div class="content">
      <div>{{ $t('欢迎体验新一代指纹浏览器协作模式！') }}</div>
      <div class="bold">
        {{ $t('在 1 个 Roxy 的团队中，您即可完成传统指纹浏览器中所有团队协作需求。') }}
      </div>
      <div>{{ $t('通过构建新的团队，您可以与更多互联网上的用户进行协作并灵活切换。') }}</div>
      <div>{{ $t('在新的团队中，一切都是独立的，您可以重新分配并配置该团队的专用资源、团队结构等。') }}</div>
      <div>{{ $t('在不久的将来，Roxy 将为跨团队转移资源提供多种支持，以更好地帮助您进行业务流转。') }}</div>
    </div>
    <RxButton class="w-full mt-[16px]" :label="$t('了解')" @click="props.hideFn!" />
  </div>
</template>

<style scoped lang="scss">
.workspace-guide {
  display: flex;
  flex-direction: column;
  gap: 10px;
  align-self: stretch;
  padding: 24px;

  .title {
    color: var(--colors-text-text-primary, #fafafa);
    font-family: Inter;
    font-size: 14px;
    font-style: normal;
    font-weight: 600;
    line-height: var(--Line-Height-text-sm, 18px);
    /* 128.571% */
  }

  .content {
    display: flex;
    flex-direction: column;
    gap: 12px;
    color: var(--colors-text-text-secondary, #b2b6b8);
    font-family: Inter;
    font-size: 12px;
    font-style: normal;
    font-weight: 400;
    line-height: 18px;
    /* 150% */

    .bold {
      color: var(--colors-text-text-secondary, #b2b6b8);
      font-family: Inter;
      font-size: 12px;
      font-style: normal;
      font-weight: 600;
      line-height: 18px;
    }
  }
}
</style>
