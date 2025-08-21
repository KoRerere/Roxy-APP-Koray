<script setup lang="ts">
import AgentList from '/@/views/agent/list/index.vue'
import AgentShop from '/@/views/agent/shop/index.vue'
import { $t } from '/@/locales'
import { useRoleStore } from '/@/stores/role'
import type { SvgNames } from '/@/components/rx-icon'

const route = useRoute()
const router = useRouter()
const { isViewer } = storeToRefs(useRoleStore())

const activeTabValue = ref((route.query.name as string) || 'list')

const tabs = computed(() => {
  return [
    { title: $t('代理列表'), value: 'list', component: markRaw(AgentList) },
    { title: $t('代理商店'), icon: 'base/rx_ic_cart_solid', suffixIcon: 'base/new_badge', value: 'shop', component: markRaw(AgentShop), visible: !isViewer.value },
  ].filter(tab => tab.visible !== false)
})

const activeTab = computed(() => tabs.value.find(tab => tab.value === activeTabValue.value))

watch(
  () => route.query.name,
  (value) => {
    // 在代理列表页点击顶部提醒跳转商店，同步 activeTabValue
    if (!!value && tabs.value.some(tab => tab.value === value) && value !== activeTabValue.value) {
      activeTabValue.value = value as string
      router.replace({ name: 'agent-list', query: route.query })
    }
  })

function onChange(value: any) {
  router.replace({ name: 'agent-list', query: { name: value } })
}
</script>

<template>
  <div class="flex flex-col h-full w-full">
    <RxTabs v-model:value="activeTabValue" :tabs="tabs" head-tabs only-tabs @update:value="onChange">
      <template #tab="{ data }">
        <div class="flex items-center gap-2">
          <SvgIcon v-if="data.icon" :name="(data.icon as SvgNames)" color="var(--colors-icon-icon-note)" />
          <div class="relative flex items-center gap-1">
            <span>{{ data.title }}</span>
            <div v-if="data.suffixIcon" class="ml-1 new-dot"></div>
          </div>
        </div>
      </template>
    </RxTabs>
    <div class="flex-1 overflow-hidden">
      <component :is="activeTab?.component" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.new-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: var(--colors-background-bg-error);
}
</style>
