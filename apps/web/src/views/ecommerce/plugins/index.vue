<script setup lang="ts">
import EcommercePageShell from '../components/ecommerce-page-shell.vue'
import Extensions from '/@/views/extensions/index.vue'
import { usePluginList } from '/@/composables/ecommerce'

usePluginList()
</script>

<template>
  <EcommercePageShell
    :title="$t('插件中心')"
    :description="$t('安装与管理电商运营所需的浏览器插件')"
    badge="Commerce"
  >
    <Extensions />
  </EcommercePageShell>
</template>
