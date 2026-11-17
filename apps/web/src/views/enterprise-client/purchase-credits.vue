<script setup lang="ts">
import { motion, useReducedMotion } from 'motion-v'
import giftImage from '/@/assets/images/enterprise-client/purchase-gift.png'
import cardDivider from '/@/assets/images/enterprise-client/purchase-card-divider.svg?url'

const { purchaseType = 'proxy' } = defineProps<{
  userName?: string
  loading: boolean
  canContact: boolean
  purchaseType?: 'proxy' | 'profile'
}>()
defineEmits<{ close: [], contact: [] }>()

const reducedMotion = useReducedMotion()
const cardInitial = computed(() => reducedMotion.value ? false : { opacity: 0, y: 24, scale: 0.98 })

function cardTransition(delay: number) {
  return reducedMotion.value
    ? { duration: 0 }
    : { type: 'spring' as const, duration: 0.28, bounce: 0.12, delay }
}
</script>

<template>
  <section class="relative flex flex-col items-center gap-7 overflow-hidden px-8 pt-8 bg-[linear-gradient(180deg,var(--colors-background-bg-page)_-8.577%,var(--colors-background-bg-gold-2,#f7dfb5)_143.43%)] dark:bg-[linear-gradient(180deg,var(--colors-background-bg-page)_-8.577%,var(--colors-background-bg-gold)_143.43%)] max-sm:px-6" aria-labelledby="purchase-credits-title">
    <img :src="giftImage" alt="" width="204" height="170" class="absolute right-10.5 top-[23.5px] h-[170px] w-[204px] object-cover pointer-events-none max-sm:right-5 max-sm:opacity-30">
    <div class="relative flex w-full flex-col items-start gap-3">
      <div class="flex w-full flex-col items-start gap-2">
        <h2 id="purchase-credits-title" class="m-0 min-w-0 max-w-full break-words pr-8 font-[Archivo] text-6 font-600 leading-[1.4] tt-primary">
          {{ userName ? $t('您的专属优惠，{name}', { name: userName }) : $t('您的专属优惠') }}
        </h2>
        <p class="m-0 max-w-full text-3.5 font-500 leading-[normal] tt-tertiary">
          {{ purchaseType === 'profile' ? $t('联系您的客户经理，领取专属代理 IP 折扣券') : $t('联系您的客户经理，领取团队席位与代理 IP 优惠券') }}
        </p>
      </div>
      <RxButton class="max-w-full !border-white/60 !text-[#97742f] !bg-[linear-gradient(152.112deg,var(--pattern-proxystore-mood-button-bg-1)_4.5385%,var(--pattern-proxystore-mood-button-bg-2)_46.418%,var(--pattern-proxystore-mood-button-bg-3)_88.298%)] [&_.p-button-label]:whitespace-normal" size="lg" icon="base/rx_ic_qrcode" :label="$t('添加客户经理')" :loading="loading" :disabled="!canContact" @click="$emit('contact')" />
    </div>
    <RxButton class="!absolute right-5 top-5 !border-0 !rounded-md" size="lg" variant="text" severity="secondary" icon="base/rx_ic_delete" :aria-label="$t('关闭')" @click="$emit('close')" />
    <div class="relative grid w-full grid-cols-2 items-stretch gap-4 max-sm:gap-3">
      <motion.article :initial="cardInitial" :animate="{ opacity: 1, y: 0, scale: 1 }" :transition="cardTransition(0)" class="flex min-w-0 flex-col items-center gap-2 overflow-hidden rounded-t-2 bg-[var(--colors-background-bg-page)] px-4 py-3 shadow-[0_4px_4px_-1px_#00000005,0_1px_1px_#0000000f] max-sm:px-2">
        <h3 class="m-0 max-w-full break-words text-center text-4 font-500 leading-[normal] tt-primary">
          {{ purchaseType === 'profile' ? $t('代理 IP 折扣券') : $t('团队成员名额') }}
        </h3>
        <div class="flex flex-wrap items-baseline justify-center font-700 leading-[normal]" :class="purchaseType === 'profile' ? 'gap-2' : 'gap-1'">
          <strong class="text-12 tt-warning max-sm:text-9">{{ purchaseType === 'profile' ? '15%' : '2' }}</strong><span class="text-6 tt-secondary max-sm:text-5">{{ purchaseType === 'profile' ? $t('优惠') : $t('个席位') }}</span>
        </div>
        <div class="h-px w-full overflow-hidden">
          <img :src="cardDivider" alt="" width="257" height="1" class="block max-w-none">
        </div>
        <p class="m-0 max-w-full text-center text-3.5 leading-[normal] tt-tertiary" :class="{ 'whitespace-nowrap': purchaseType === 'profile' }">
          {{ purchaseType === 'profile' ? $t('满20条·有效90天') : $t('团队席位永久有效，随时可以使用') }}
        </p>
      </motion.article>
      <motion.article :initial="cardInitial" :animate="{ opacity: 1, y: 0, scale: 1 }" :transition="cardTransition(0.08)" class="flex min-w-0 flex-col items-center gap-2 overflow-hidden rounded-t-2 bg-[var(--colors-background-bg-page)] px-4 py-3 shadow-[0_4px_4px_-1px_#00000005,0_1px_1px_#0000000f] max-sm:px-2">
        <h3 class="m-0 max-w-full break-words text-center text-4 font-500 leading-[normal] tt-primary">
          {{ purchaseType === 'profile' ? $t('代理 IP 折扣券') : $t('代理 IP 优惠券') }}
        </h3>
        <div class="flex flex-wrap items-baseline justify-center gap-2 font-700 leading-[normal]">
          <strong class="text-12 tt-warning max-sm:text-9">15%</strong><span class="text-6 tt-secondary max-sm:text-5">{{ $t('优惠') }}</span>
        </div>
        <div class="h-px w-full overflow-hidden">
          <img :src="cardDivider" alt="" width="257" height="1" class="block max-w-none">
        </div>
        <p class="m-0 max-w-full whitespace-nowrap text-center text-3.5 leading-[normal] tt-tertiary">
          {{ $t('满20条·有效90天') }}
        </p>
      </motion.article>
    </div>
    <div aria-hidden="true" class="pointer-events-none absolute inset-0 shadow-[inset_0_-8px_20px_0_#fc9d121a]" />
  </section>
</template>
