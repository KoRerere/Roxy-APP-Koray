<script setup lang="tsx">
import Services from '/@/views/pay/wallet/manage/services.vue'
import AutoRenew from '/@/views/pay/wallet/manage/auto-renew.vue'
import Wallet from '/@/views/pay/wallet/manage/wallet.vue'
import BankCards from '/@/views/pay/wallet/manage/bank-cards.vue'
// import Redeem from '/@/views/pay/wallet/manage/redeem.vue'
import { useUserStore } from '/@/stores/user';

const { getUserPayInfo } = useUserStore()

onBeforeMount(() => {
  getUserPayInfo()
})

</script>

<template>
  <div class="flex flex-col w-full h-full overflow-y-auto">
    <div class="rx-container h-auto">
      <div class="flex gap-14 px-16 pt-6 pb-10">
        <div class="flex-1 flex flex-col gap-8 overflow-hidden">
          <Services></Services>
          <AutoRenew class="h-70"></AutoRenew>
        </div>
        <RxDivider vertical line-only />
        <div class="w-90 flex flex-col gap-6">
          <Wallet></Wallet>
          <RxDivider line-only line-style="dashed" line-color="var(--colors-border-divider-dashed)" />
          <BankCards></BankCards>
          <!-- <RxDivider line-only line-style="dashed" line-color="var(--colors-border-divider-dashed)" />
          <Redeem></Redeem> -->
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss"></style>
