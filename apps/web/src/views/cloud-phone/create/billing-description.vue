<script setup lang="ts">
import { useI18n } from 'vue-i18n'

defineProps<{ monthly?: boolean }>()
const { t: $t } = useI18n()
</script>

<template>
  <section class="rounded-2 bg-[var(--colors-background-bg-app,#f5fbff)] p-4">
    <h3 class="mb-2 mt-0 text-4 font-medium">
      {{ $t('设备计费说明') }}
    </h3>
    <!-- 计费文案及价格来自本次 Figma 设计稿。 -->
    <ol v-if="!monthly" class="m-0 pl-4.5 text-3 leading-5 text-[var(--colors-text-text-tertiary)]">
      <li>{{ $t('云手机按分钟计费，优先使用并发额度（不额外收费）。') }}</li>
      <li>{{ $t('其次依次扣除免费时长及套餐时长，订阅后时长套餐每日最高扣除 172 分钟。') }}</li>
      <li>{{ $t('最后按 $0.007/分钟计费，订阅后享每日 $1.20 封顶。') }}</li>
      <li>{{ $t('不使用不收费。') }}</li>
    </ol>
    <p v-else class="m-0 text-3 leading-5 text-[var(--colors-text-text-tertiary)]">
      {{ $t('按月使用云手机，套餐价格和可用额度以订阅页面为准。') }}
    </p>
  </section>
</template>
