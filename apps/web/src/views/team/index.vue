<script setup lang="ts">

import { useRoleStore } from '/@/stores/role'
import OperationLog from './operation-log.vue'
import TeamMember from './team-member.vue'
import TransferHistory from '/@/views/browser/list/transfer/history.vue'

const route = useRoute()
const router = useRouter()
const role = useRoleStore()
const activeTabValue = ref((route.query.name as string) || 'team-member')

const tabs = computed(() => {
  return [
    { title: $t('团队成员'), value: 'team-member', component: TeamMember, visible: true },
    { title: $t('操作日志'), value: 'operation-log', component: OperationLog, visible: role.isOwner || role.isManager },
    { title: $t('投送历史'), value: 'transfer-record', component: TransferHistory, visible: role.isOwner },
  ].filter(tab => tab.visible !== false)
})

const activeTab = computed(() => {
  return tabs.value.find(tab => tab.value === activeTabValue.value)
})

function onChange(value: any) {
  router.replace({ name: 'teams', query: { name: value } })
}
</script>

<template>
  <div class="flex flex-col h-full w-full">
    <RxTabs v-model:value="activeTabValue" :tabs="tabs" head-tabs only-tabs @update:value="onChange"></RxTabs>
    <div class="flex-1 overflow-hidden">
      <component :is="activeTab?.component" />
    </div>
  </div>
</template>

<style lang="scss" scoped></style>
