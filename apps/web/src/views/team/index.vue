<script setup lang="ts">
import { $t } from '/@/locales'
import { useRoleStore } from '/@/stores/role'
import OperationLog from './operation-log.vue'
import TeamMember from './team-member.vue'

const role = useRoleStore()
const activeTabValue = ref('team-member')

const tabs = computed(() => {
  return [
    { title: $t('团队成员'), value: 'team-member', component: TeamMember, visible: true },
    { title: $t('操作日志'), value: 'operation-log', component: OperationLog, visible: role.isOwner || role.isManager },
  ].filter(tab => tab.visible !== false)
})

const activeTab = computed(() => {
  return tabs.value.find(tab => tab.value === activeTabValue.value)
})
</script>

<template>
  <div class="flex flex-col h-full w-full">
    <RxTabs v-model:value="activeTabValue" :tabs="tabs" head-tabs only-tabs></RxTabs>
    <div class="flex-1 overflow-hidden">
      <component :is="activeTab?.component" />
    </div>
  </div>
</template>

<style lang="scss" scoped></style>
