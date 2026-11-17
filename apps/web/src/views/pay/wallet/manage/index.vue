<script setup lang="ts">
import Services from '/@/views/pay/wallet/manage/services.vue'
import AutoRenew from '/@/views/pay/wallet/manage/auto-renew.vue'
import WalletServiceLayout from '../components/wallet-service-layout.vue'
import NewUserActivityInfoWallet from '/@/views/campaign/new-user/activity-info-wallet.vue'
</script>

<template>
  <WalletServiceLayout fill-height>
    <Services />
    <NewUserActivityInfoWallet class="relative z-1" />
    <AutoRenew class="flex-1" />
  </WalletServiceLayout>
</template>
