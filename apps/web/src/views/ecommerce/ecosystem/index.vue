<script setup lang="ts">
import EcommercePageShell from '../components/ecommerce-page-shell.vue'
import RxButton from '/@/components/rx-button'

const highlights = [
  {
    title: '跨境支付',
    description: '聚合主流跨境收款与结算服务，降低出海收款门槛。',
  },
  {
    title: '物流履约',
    description: '对接海外仓与专线物流，提升订单履约效率。',
  },
  {
    title: '营销工具',
    description: '覆盖广告投放、选品分析与店铺运营等生态能力。',
  },
]
</script>

<template>
  <EcommercePageShell
    :title="$t('生态中心')"
    :description="$t('探索 Roxy 电商生态合作伙伴与增值服务')"
    badge="Marketing"
  >
    <div class="px-6 py-8 flex flex-col gap-6 overflow-y-auto h-full">
      <div class="rounded-xl p-6 bg-gradient-to-r from-[var(--colors-background-bg-brand-subtle)] to-transparent border border-[var(--colors-border-border-base)]">
        <h2 class="text-lg font-semibold mb-2">
          {{ $t('构建您的跨境业务生态') }}
        </h2>
        <p class="text-sm text-[var(--colors-text-text-secondary)] mb-4 max-w-2xl">
          {{ $t('生态中心汇聚支付、物流、营销等合作伙伴能力。正式素材将由运营团队后续更新。') }}
        </p>
        <RxButton :label="$t('了解更多')" icon="base/rx_ic_doc_code" />
      </div>

      <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div
          v-for="item in highlights"
          :key="item.title"
          class="rounded-lg border border-[var(--colors-border-border-base)] p-4 bg-[var(--colors-background-bg-subtle)]"
        >
          <h3 class="font-medium mb-2">
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
