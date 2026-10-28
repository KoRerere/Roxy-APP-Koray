<script setup lang="tsx">
import Services from '/@/views/pay/wallet/manage/services.vue'
import AutoRenew from '/@/views/pay/wallet/manage/auto-renew.vue'
import Wallet from '/@/views/pay/wallet/manage/wallet.vue'
import BankCards from '/@/views/pay/wallet/manage/bank-cards.vue'
import NewUserActivityInfoWallet from '/@/views/campaign/new-user/activity-info-wallet.vue'
// import Redeem from '/@/views/pay/wallet/manage/redeem.vue'
import { useUserStore } from '/@/stores/user'

const { getUserPayInfo } = useUserStore()

/** 余额刷新按钮：idle / 转圈中(至少1秒) / 成功勾号展示2秒 */
const balanceRefreshUi = ref<'idle' | 'loading' | 'success'>('idle')
let balanceRefreshSuccessTimer: ReturnType<typeof setTimeout> | undefined

onBeforeMount(() => {
  getUserPayInfo()
})

onBeforeUnmount(() => {
  if (balanceRefreshSuccessTimer) {
    clearTimeout(balanceRefreshSuccessTimer)
  }
})

function onRefresh() {
  if (balanceRefreshUi.value !== 'idle') {
    return
  }

  balanceRefreshUi.value = 'loading'
  const startedAt = Date.now()

  getUserPayInfo()
    .finally(() => {
      const remainingSpin = Math.max(0, 1000 - (Date.now() - startedAt))
      setTimeout(() => {
        balanceRefreshUi.value = 'success'
        if (balanceRefreshSuccessTimer) {
          clearTimeout(balanceRefreshSuccessTimer)
        }
        balanceRefreshSuccessTimer = setTimeout(() => {
          balanceRefreshUi.value = 'idle'
        }, 2000)
      }, remainingSpin)
    })
}
</script>

<template>
  <div class="w-full h-full overflow-hidden">
    <div class="rx-container h-full">
      <!-- 左右两栏各自独立滚动 -->
      <div class="h-full flex justify-center items-stretch gap-7 px-10">
        <!-- 左栏：资源与自动续费 -->
        <div class="flex-1 min-w-0 max-w-[620px] h-full overflow-y-auto scroll-col">
          <!-- min-h-full + 自动续费 flex-1：内容少时表格向下撑满到页面底部 -->
          <div class="min-h-full flex flex-col gap-5 pt-8 pb-10">
            <Services />
            <NewUserActivityInfoWallet class="relative z-1" />
            <AutoRenew class="flex-1" />
          </div>
        </div>
        <div class="shrink-0 w-0 my-8 border-l border-l-dashed border-[var(--colors-border-border-subtle,#c7d1d6)]" />
        <!-- 右栏：钱包卡 + 付款卡片面板（面板上移压住钱包卡下半部分） -->
        <div class="shrink-0 w-95 h-full overflow-y-auto scroll-col">
          <div class="flex flex-col pt-8 pb-10">
            <Wallet :balance-refresh-ui="balanceRefreshUi" @refresh="onRefresh" />
            <BankCards class="-mt-48.5" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
// 隐藏滚动条但保留滚动，避免两栏滚动条占位导致布局抖动
.scroll-col {
  scrollbar-width: none;

  &::-webkit-scrollbar {
    display: none;
  }
}
</style>
