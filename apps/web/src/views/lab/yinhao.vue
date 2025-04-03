<script setup lang="tsx">
import PlanModal from '../pay/wallet/components/plan-success.vue'
import BalanceModal from '../pay/wallet/components/balance-success.vue'
import { format } from 'date-fns'
import { $t } from '/@/locales';
import { useDialog } from '/@/hooks/useDialog'
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
//====================

const columns = ref([
  {
    title: 'aaa',
    key: 'aaa',
    width: 100,
  },
  {
    title: 'bbb',
    key: 'bbb',
    width: 100,
  },
  {
    title: 'ccc',
    key: 'ccc',
    // props: {
    //   eye: false
    // },
    headerSlot: 'mannnnnn',
    width: 100,
  },
  {
    title: 'ddd',
    key: 'ddd',
    width: 100,
  },
])

const data = Array.from({ length: 10 }, (_, index) => ({
  aaa: index,
  bbb: index * 2,
  ccc: index * 3,
}))
</script>

<template>
  <div class="relative back">
    <RxButton class="!w-20" @click="open1">plan</RxButton>
    <RxButton class="!w-20" @click="open2">blance</RxButton>
    <br>
    <br>
    <div class="flex w-260 h-100 gap-20 overflow-hidden">
      <RyTable :columns="columns" :data-list="data" show-gridlines :showTableHeader="false" :paginator="false" :showActions="false">
        <template #mannnnnn="{ column }">
          <span class="text-red">{{ column.title }}</span>
        </template>
      </RyTable>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.progress {
  &-value {
    fill: none;
    stroke-width: 4.5;
    stroke-dasharray: calc(2 * 3.14159 * 14);
    stroke: var(--stroke-color, #12A3FC);
    stroke-linecap: round;
    stroke-dashoffset: calc(2 * 3.14159 * 14 * var(--progress));
  }

  &-circle {
    transform: rotate(-90deg);
  }

  &-bg {
    fill: none;
    stroke: #E8F5FC;
    stroke-width: 4.5;
  }
}
</style>
