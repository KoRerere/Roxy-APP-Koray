<script setup lang="ts">
const props = defineProps({
  hideFn: Function,
})
</script>

<template>
  <div class="workspace-guide">
    <img src="/workspace_banner.svg" class="w-full">
    <div class="title">
      {{ $t('Roxy工作空间说明') }}
    </div>
    <div class="content">
      <div>{{ $t('欢迎体验新一代指纹浏览器协作模式！') }}</div>
      <div class="bold">
        {{ $t('在1个Roxy的工作空间中，您即可完成传统指纹浏览器中所有团队协作需求。') }}
      </div>
      <div>{{ $t('通过构建新的工作空间，您可以与更多互联网上的用户进行协作并灵活切换。') }}</div>
      <div>{{ $t('在新的空间中，一切都是独立的，您可以重新分配并配置该空间的专用资源、团队结构等。') }}</div>
      <div>{{ $t('在不久的将来，Roxy将为跨空间投送资源提供多种支持，以更好地帮助您进行业务流转。') }}</div>
    </div>
    <RxButton class="w-full mt-[16px]" :label="$t('了解')" @click="props.hideFn" />
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
