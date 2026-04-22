<script setup lang="tsx">
import Services from '/@/views/pay/wallet/manage/services.vue'
import AutoRenew from '/@/views/pay/wallet/manage/auto-renew.vue'
import Wallet from '/@/views/pay/wallet/manage/wallet.vue'
import BankCards from '/@/views/pay/wallet/manage/bank-cards.vue'
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
  if (balanceRefreshSuccessTimer)
    clearTimeout(balanceRefreshSuccessTimer)
})

function onRefresh() {
  if (balanceRefreshUi.value !== 'idle')
    return

  balanceRefreshUi.value = 'loading'
  const startedAt = Date.now()

  getUserPayInfo()
    .finally(() => {
      const remainingSpin = Math.max(0, 1000 - (Date.now() - startedAt))
      setTimeout(() => {
        balanceRefreshUi.value = 'success'
        if (balanceRefreshSuccessTimer)
          clearTimeout(balanceRefreshSuccessTimer)
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
      <div class="flex gap-14 px-16 pt-6 pb-10">
        <div class="flex-1 flex flex-col gap-8 overflow-hidden">
          <Services />
          <AutoRenew class="h-70" />
        </div>
        <RxDivider vertical line-only />
        <div class="w-90 flex flex-col gap-6">
          <Wallet :balance-refresh-ui="balanceRefreshUi" @refresh="onRefresh">
            <template #footer>
              <RxDivider line-only line-style="dashed" line-color="var(--colors-border-divider-dashed)" />
              <BankCards />
            </template>
          </Wallet>

          <!-- <RxDivider line-only line-style="dashed" line-color="var(--colors-border-divider-dashed)" />
          <Redeem></Redeem> -->
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss"></style>
