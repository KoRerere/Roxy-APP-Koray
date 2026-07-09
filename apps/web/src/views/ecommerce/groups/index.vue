<script setup lang="ts">
import EcommercePageShell from '../components/ecommerce-page-shell.vue'
import ProjectsIndex from '/@/views/projects/index.vue'
import { useAccountGroups } from '/@/composables/ecommerce'

useAccountGroups()
</script>

<template>
  <EcommercePageShell
    :title="$t('账号分组')"
    :description="$t('按店铺、平台或运营场景对账号进行分组管理')"
    badge="Commerce"
  >
    <ProjectsIndex />
  </EcommercePageShell>
</template>
