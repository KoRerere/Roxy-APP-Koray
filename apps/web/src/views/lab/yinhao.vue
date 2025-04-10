<script setup lang="tsx">
import PlanModal from '../pay/wallet/components/plan-success.vue'
import BalanceModal from '../pay/wallet/components/balance-success.vue'
import { useDialog } from '/@/hooks/useDialog'
import Position from '/@/views/browser/create/components/position.vue'

const [dialogInstance] = useDialog()

function open1() {
  dialogInstance.showModal({
    showHeader: false,
    modal: true,
    blockScroll: true,
    innerDialog: true,
    pt: {
      content: '!pa-0'
    },
    slots: {
      container: () => <PlanModal />,
    },
  })
}

function open2() {
  dialogInstance.showModal({
    showHeader: false,
    modal: true,
    blockScroll: true,
    innerDialog: true,
    pt: {
      content: '!pa-0'
    },
    slots: {
      container: () => <BalanceModal />,
    },
  })
}

//=================================

const data = ref({
  windowRemark: '1111111'
})
</script>

<template>
  <div class="relative back">
    <RxButton class="!w-20" @click="open1">plan</RxButton>
    <RxButton class="!w-20" @click="open2">blance</RxButton>
    <br>
    <br>

    <!-- <RxButton v-tooltip.top="{ value: data.windowRemark, showDelay: 0 }" text severity="secondary" size="xxs">
      <SvgIcon :name="data.windowRemark ? 'base/rx_ic_doc_fill' : 'base/rx_ic_doc_add'" :class="{ 'color-[#12A3FC]': data.windowRemark }" class="cursor-pointer" />
    </RxButton> -->

    <!-- <SvgIcon  :class="{ 'color-[#12A3FC]': data.windowRemark }" class="cursor-pointer" /> -->


    <div class="flex items-center gap-1">
      <RxButton v-tooltip.top="{ value: data.windowRemark, showDelay: 0 }" :class="{ 'remark-light': data.windowRemark }" text severity="secondary" size="xxs"
        :icon="data.windowRemark ? 'base/rx_ic_doc_fill' : 'base/rx_ic_doc_add'" :label="data.windowRemark ? '' : $t('添加备注')"></RxButton>
      <span>{{ data.windowRemark }}</span>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.remark-light {
  :deep(svg) {
    color: var(--Colors-text-text-brand, #11A3FD) !important;
  }
}
</style>
