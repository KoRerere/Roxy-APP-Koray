<script setup lang="ts">
const { data } = defineProps<{
  data?: Record<string, any>
}>()

const message = computed(() => {
  switch (data?.errorCode || 0) {
    case 402:
      return $t('您的 Roxy AI Agent 请求已达上限，如需调整体验额度，请与我们的技术支持联系。')
    case 429:
      return $t('您的 Roxy AI Agent 请求过于频繁，请稍后重试。')
    case 400:
      return $t('模型不支持，请尝试将 APP 更到最新版本，或者重启 Roxy AI Agent 窗口')
    case 403:
      return $t('图片生成次数已用完，如需继续使用，请联系技术支持。')
    case 406:
      return $t('图片内容涉及敏感信息，请修改描述后重试。')
    case 504:
      return $t('额度限制，如需体验额度，请联系技术支持。')
    default:
      return $t('未知错误，请联系技术支持。')
  }
})
</script>

<template>
  <div class="flex items-center gap-1.5 status-message status-error">
    <SvgIcon name="base/rx_ic_delete" size="14" />
    <span>{{ message }}</span>
  </div>
</template>

<style lang="scss" scoped>
.status-message {
  font-size: 12px;
  line-height: 1.5;
}

.status-error {
  background: var(--colors-background-bg-error-subtle);
  color: var(--colors-text-text-error);
}

.status-interrupt {
  background: var(--colors-background-bg-warning-subtle);
  color: var(--colors-text-text-warning);
}
</style>
