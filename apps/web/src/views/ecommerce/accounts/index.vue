<script setup lang="ts">
import EcommercePageShell from '../components/ecommerce-page-shell.vue'
import Profiles from '/@/views/browser/list/profiles/index.vue'
import { useAccountList } from '/@/composables/ecommerce'

useAccountList()
</script>

<template>
  <EcommercePageShell
    :title="$t('全部账号')"
    :description="$t('统一管理电商平台的浏览器账号与环境配置')"
    badge="Commerce"
  >
    <Profiles />
  </EcommercePageShell>
</template>
