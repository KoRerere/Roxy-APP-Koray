<script setup lang="ts">
import Manage from '/@/views/pay/wallet/manage/index.vue'
import Billing from '/@/views/pay/wallet/billing/index.vue'
import CloudPhone from './cloud-phone/index.vue'
import { useRouteContext } from '/@/composables/useRouteContext'
import './wallet-theme.css'

const route = useRoute()
const router = useRouter()
const { isNormal } = useRouteContext()

const tabs = computed(() => {
  return [
    { title: $t('服务和钱包'), value: 'manage', component: markRaw(Manage) },
    ...(isNormal.value ? [{ title: $t('云手机'), value: 'cloud-phone', component: markRaw(CloudPhone) }] : []),
    { title: $t('账单'), value: 'billing', component: markRaw(Billing) },
  ]
})

const activeTabValue = computed({
  get: () => tabs.value.some(tab => tab.value === route.query.name) ? route.query.name as string : 'manage',
  set: (name: string) => {
    router.replace({ name: 'wallet', query: { ...route.query, name } })
  },
})
const activeTab = computed(() => tabs.value.find(tab => tab.value === activeTabValue.value))
</script>

<template>
  <div class="wallet-page flex flex-col h-full w-full">
    <RxTabs v-model:value="activeTabValue" :tabs="tabs" head-tabs only-tabs />
    <div class="min-h-0 flex-1 overflow-hidden">
      <component :is="activeTab?.component" />
    </div>
  </div>
</template>

<style lang="scss" scoped></style>
