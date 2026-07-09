<script setup lang="ts">
import EcommercePageShell from '../components/ecommerce-page-shell.vue'
import ProjectItem from '/@/views/projects/project-item.vue'
</script>

<template>
  <EcommercePageShell
    :title="$t('账号分组')"
    :description="$t('查看分组详情与成员权限')"
    badge="Commerce"
  >
    <ProjectItem />
  </EcommercePageShell>
</template>
