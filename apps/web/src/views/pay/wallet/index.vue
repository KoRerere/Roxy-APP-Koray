<script setup lang="ts">
import Manage from '/@/views/pay/wallet/manage/index.vue'
import Billing from '/@/views/pay/wallet/billing/index.vue'

const route = useRoute()
const router = useRouter()

const activeTabValue = ref((route.query.name as string) || 'manage')

const tabs = computed(() => {
  return [
    { title: $t('服务和钱包'), value: 'manage', component: markRaw(Manage) },
    { title: $t('账单'), value: 'billing', component: markRaw(Billing) },
  ]
})

const activeTab = computed(() => tabs.value.find(tab => tab.value === activeTabValue.value))

watch(
  () => route.query.name,
  (value) => {
    if (!!value && tabs.value.some(tab => tab.value === value) && value !== activeTabValue.value) {
      activeTabValue.value = value as string
      router.replace({ name: 'wallet', query: route.query })
    }
  },
)

function onChange(value: any) {
  router.replace({ name: 'wallet', query: { name: value } })
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
