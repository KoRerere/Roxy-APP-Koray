<script setup lang="ts">
import TransferTrade from '/@/views/browser/list/transfer/components/transfer-trade.vue'
import TramsferNormal from '/@/views/browser/list/transfer/components/tramsfer-normal.vue'
import { useRoleStore } from '/@/stores/role'
import { useUserStore } from '/@/stores/user'
import { PayIdentity } from '/@/enums/pay'

const { ids: windowIds, buyProxyType = false } = defineProps<{
  datas: Record<string, any>[]
  ids: number[]
  buyProxyType?: boolean
}>()

defineEmits(['close', 'confirm'])

const { isOwner } = storeToRefs(useRoleStore())
const { identityInfo } = storeToRefs(useUserStore())

const tabsRef = useTemplateRef('tabs')

const tabs = computed(() => [
  { title: $t('转移临时窗口'), value: 'trade', icon: identityInfo.value.icon, component: markRaw(TransferTrade) },
  { title: $t('普通转移'), value: 'normal', component: markRaw(TramsferNormal) },
])

const activeKey = ref(tabs.value[0]!.value)

const isAgentUser = computed(() => identityInfo.value.identity === PayIdentity.agent && isOwner.value)

const activeComponent = computed(() => {
  if (!isAgentUser.value)
    return TramsferNormal
  return tabs.value.find(tab => tab.value === activeKey.value)!.component
})

function updateInkBar() {
  tabsRef.value?.updateInkBar()
}
</script>

<template>
  <div class="flex flex-col pa-6 pt-4 gap-5 max-h-[80vh] overflow-y-auto transfer">
    <div class="flex justify-between items-center">
      <span class="header">{{ windowIds.length > 1 ? $t('转移 {count} 个窗口', { count: windowIds.length }) : $t('转移窗口') }}</span>
      <SvgIcon class="cursor-pointer" name="base/rx_ic_delete" size="20" color="var(--colors-icon-icon-secondary)" @click="$emit('close')" />
    </div>
    <RxTabs v-if="isAgentUser" ref="tabs" v-model:value="activeKey" :tabs="tabs" :show-navigators="false" head-tabs only-tabs />
    <component :is="activeComponent" :ids="windowIds" :datas="datas" :buy-proxy-type="buyProxyType" @resize="updateInkBar" @confirm="$emit('confirm', $event)" />
  </div>
</template>

<style lang="scss" scoped>
.transfer {
  :deep(.p-tab) {
    flex: auto;
  }
}
</style>
