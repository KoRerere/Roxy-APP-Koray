<script setup lang="tsx">
import Services from '/@/views/pay/wallet/manage/services.vue'
import AutoRenew from '/@/views/pay/wallet/manage/auto-renew.vue'
import Wallet from '/@/views/pay/wallet/manage/wallet.vue'
import BankCards from '/@/views/pay/wallet/manage/bank-cards.vue'
import ActivityInfoWallet from '/@/views/campaign/new-user/activity-info-wallet.vue'
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
  <div class="flex flex-col w-full h-full overflow-y-auto">
    <div class="rx-container h-auto">
      <div class="flex flex-col gap-4 px-16 pt-6 pb-10">
        <div class="flex items-stretch gap-4">
          <Wallet class="min-w-0 flex-[1.4]" :balance-refresh-ui="balanceRefreshUi" @refresh="onRefresh" />
          <BankCards class="min-w-0 flex-1" />
        </div>
        <Services />
        <ActivityInfoWallet class="relative z-1" />
        <AutoRenew />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss"></style>
