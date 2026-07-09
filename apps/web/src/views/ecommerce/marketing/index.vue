<script setup lang="ts">
import EcommercePageShell from '../components/ecommerce-page-shell.vue'
import RxButton from '/@/components/rx-button'

const campaigns = [
  {
    title: 'Prime Day 备战',
    description: '旺季前完成账号环境隔离、素材与投放链路检查。',
    tag: 'Campaign',
  },
  {
    title: '多店铺矩阵',
    description: '按站点与品类拆分账号分组，降低关联风险。',
    tag: 'Strategy',
  },
  {
    title: '自动化运营',
    description: '结合 RoxyClaw 与 API 能力实现日常运营自动化。',
    tag: 'Automation',
  },
]
</script>

<template>
  <EcommercePageShell
    :title="$t('跨境营销')"
    :description="$t('跨境营销方案与活动推荐（静态占位）')"
    badge="Marketing"
  >
    <div class="px-6 py-8 flex flex-col gap-6 overflow-y-auto h-full">
      <div class="rounded-xl overflow-hidden border border-[var(--colors-border-border-base)]">
        <div class="h-36 bg-gradient-to-br from-[#1d4ed8] to-[#7c3aed] flex items-center px-8">
          <div>
            <p class="text-white/80 text-sm mb-1">
              Roxy Commerce
            </p>
            <h2 class="text-2xl font-semibold text-white">
              {{ $t('跨境营销增长方案') }}
            </h2>
          </div>
        </div>
        <div class="p-6 bg-[var(--colors-background-bg-base)]">
          <p class="text-sm text-[var(--colors-text-text-secondary)] mb-4">
            {{ $t('此处为 Phase 2 静态占位页，后续由运营提供正式营销素材。') }}
          </p>
          <RxButton :label="$t('联系顾问')" icon="base/rx_ic_message" />
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div
          v-for="item in campaigns"
          :key="item.title"
          class="rounded-lg border border-[var(--colors-border-border-base)] p-4"
        >
          <span class="text-xs text-[var(--colors-text-text-brand)]">{{ item.tag }}</span>
          <h3 class="font-medium mt-2 mb-2">
            {{ item.title }}
          </h3>
          <p class="text-sm text-[var(--colors-text-text-secondary)]">
            {{ item.description }}
          </p>
        </div>
      </div>
    </div>
  </EcommercePageShell>
</template>
