<script setup lang="ts">
import EcommercePageShell from '../components/ecommerce-page-shell.vue'
import AgentShop from '/@/views/agent/shop/index.vue'
import { useDeviceList } from '/@/composables/ecommerce'

useDeviceList()
</script>

<template>
  <EcommercePageShell
    :title="$t('我的设备')"
    :description="$t('管理电商业务使用的代理 IP 与网络设备')"
    badge="Commerce"
  >
    <AgentShop />
  </EcommercePageShell>
</template>
