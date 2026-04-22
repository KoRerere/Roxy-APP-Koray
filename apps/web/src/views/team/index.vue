<script setup lang="ts">
import TeamMember from './team-member.vue'
import OperationLog from './operation-log.vue'
import TransferHistory from '/@/views/browser/list/transfer/history.vue'
import { usePermission } from '/@/hooks/usePermission'

const route = useRoute()
const router = useRouter()
const { check } = usePermission()
const activeTabValue = ref((route.query.name as string) || 'team-member')

const tabs = computed(() => {
  return [
    { title: $t('团队成员'), value: 'team-member', component: TeamMember, visible: true },
    { title: $t('操作日志'), value: 'operation-log', component: OperationLog, visible: check('Team_Log_view_page') },
    { title: $t('转移历史'), value: 'transfer-record', component: TransferHistory, visible: check('Team_Transfer_view_page') },
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
    <RxTabs v-model:value="activeTabValue" :tabs="tabs" head-tabs only-tabs @update:value="onChange" />
    <div class="flex-1 overflow-hidden">
      <component :is="activeTab?.component" />
    </div>
  </div>
</template>

<style lang="scss" scoped></style>
