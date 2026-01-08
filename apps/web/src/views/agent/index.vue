<script setup lang="ts">
import AgentList from '/@/views/agent/list/index.vue'
import AgentShop from '/@/views/agent/shop/index.vue'
import { useUserStore } from '/@/stores/user'
import { useRoleStore } from '/@/stores/role'
import type { SvgNames } from '/@/components/rx-icon'

const route = useRoute()
const router = useRouter()
const { isViewer } = storeToRefs(useRoleStore())
const { userPayInfo, identityInfo } = storeToRefs(useUserStore())

const activeTabValue = ref((route.query.name as string) || 'shop')

const tabs = computed(() => {
  return [
    { title: $t('代理 IP 商店'), icon: 'base/rx_ic_cart_solid', suffixIcon: 'base/new_badge', value: 'shop', component: markRaw(AgentShop), visible: !isViewer.value },
    { title: $t('代理 IP 列表'), value: 'list', component: markRaw(AgentList) },
  ].filter(tab => tab.visible !== false)
})

const activeTab = computed(() => tabs.value.find(tab => tab.value === activeTabValue.value))

watch(
  () => route.query.name,
  (value) => {
    // 在代理列表页点击顶部提醒跳转商店，同步 activeTabValue
    if (!!value && tabs.value.some(tab => tab.value === value) && value !== activeTabValue.value) {
      activeTabValue.value = value as string
    }
  },
)

function onChange(value: any) {
  router.replace({ name: 'agent-list', query: { name: value } })
}
</script>

<template>
  <div class="flex flex-col h-full w-full">
    <div class="flex items-center">
      <RxTabs v-model:value="activeTabValue" class="flex-1" :tabs="tabs" head-tabs only-tabs @update:value="onChange">
        <template #tab="{ data }">
          <div class="flex items-center gap-2">
            <SvgIcon v-if="data.icon" :name="(data.icon as SvgNames)" color="var(--colors-icon-icon-note)" />
            <div class="relative flex items-center gap-1">
              <span>{{ data.title }}</span>
            </div>
          </div>
        </template>
      </RxTabs>
      <div v-if="userPayInfo.proxyDiscount && activeTabValue === 'shop'" class="h-full flex items-center pl-2.5 pr-6 gap-2.5 discount">
        <div v-if="identityInfo.icon" class="flex items-center gap-0.5">
          <SvgIcon :name="(identityInfo.icon as any)" />
          <div class="discount-identity">
            {{ identityInfo.text }}
          </div>
        </div>
        <i18n-t tag="div" scope="global" :keypath="$t('代理 IP 商店: {discount}', { discount: '{discount}' })">
          <template #discount>
            <span class="discount-value">{{ $t('额外 {value}% 折扣', { value: userPayInfo.proxyDiscount }) }}</span>
          </template>
        </i18n-t>
      </div>
    </div>
    <div class="flex-1 overflow-hidden">
      <component :is="activeTab?.component" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.discount {
  color: var(--colors-text-text-secondary);
  font-size: 12px;
  line-height: 20px;
  border-bottom: 0.5px solid var(--tabs-tablist-border-color);

  &-identity {
    color: var(--colors-text-text-primary);
    font-family: 'DingTalk JinBuTi';
  }

  &-value {
    color: var(--colors-text-text-warning);
    font-family: 'DingTalk JinBuTi';
  }
}
</style>
