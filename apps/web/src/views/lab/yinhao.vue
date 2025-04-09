<script setup lang="tsx">
import PlanModal from '../pay/wallet/components/plan-success.vue'
import BalanceModal from '../pay/wallet/components/balance-success.vue'
import { useDialog } from '/@/hooks/useDialog'
import { sleep } from '/@/utils'


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
// const products = Array.from({ length: 10 }, (_, index) => ({
//   id: index,
//   code: 'f230fh0g3',
//   name: 'Bamboo Watch',
//   description: 'Product Description',
//   image: 'bamboo-watch.jpg',
//   price: 65,
//   category: 'Accessories',
//   quantity: 24,
//   inventoryStatus: 'INSTOCK',
//   rating: 5
// }))

// const columns = [
//   { field: 'code', header: 'Code' },
//   { field: 'name', header: 'Name' },
//   { field: 'category', header: 'Category' },
//   { field: 'quantity', header: 'Quantity' }
// ]

//=================================
import { motion, AnimatePresence } from 'motion-v'

</script>

<template>
  <div class="relative back">
    <RxButton class="!w-20" @click="open1">plan</RxButton>
    <RxButton class="!w-20" @click="open2">blance</RxButton>
    <br>
    <br>
    <!-- <div class="flex w-260 h-100 gap-20 overflow-hidden">
      <DataTable :value="products">
        <Column v-for="col of columns" :key="col.field" :field="col.field" :header="col.header"></Column>
      </DataTable>
    </div> -->

  </div>
</template>

<style lang="scss" scoped></style>
