<script setup lang="ts">
import TransferTrade from '/@/views/browser/list/transfer/components/transfer-trade.vue'
import TramsferNormal from '/@/views/browser/list/transfer/components/tramsfer-normal.vue'
import { useProfileEntityLabels } from '/@/composables/useProfileEntityLabels'
import { useTransferEntityLabels } from '/@/composables/useTransferEntityLabels'
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
const profileLabels = useProfileEntityLabels()
const transferLabels = useTransferEntityLabels()

const tabsRef = useTemplateRef('tabs')

const tabs = computed(() => [
  { title: transferLabels.value.transferTempTab, value: 'trade', icon: identityInfo.value.icon, component: markRaw(TransferTrade) },
  { title: $t('普通转移'), value: 'normal', component: markRaw(TramsferNormal) },
])

const activeKey = ref(tabs.value[0]!.value)

const isPremiumPartner = computed(() => identityInfo.value.identity === PayIdentity.agent && isOwner.value)

const activeComponent = computed(() => {
  if (!isPremiumPartner.value)
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
      <span class="header">{{ windowIds.length > 1 ? profileLabels.transferMultiple(windowIds.length) : profileLabels.transferSingle }}</span>
      <SvgIcon class="cursor-pointer" name="base/rx_ic_delete" size="20" color="var(--colors-icon-icon-secondary)" @click="$emit('close')" />
    </div>
    <RxTabs v-if="isPremiumPartner" ref="tabs" v-model:value="activeKey" :tabs="tabs" :show-navigators="false" head-tabs only-tabs />
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
