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

const spaces = [
  {
    title: 'Transfer history',
    items: [
      {
        label: 'XX',
        name: 'Roxy Time',
        id: '0311'
      }
    ],
    clear: (item: any) => {
      console.log(item)
    }
  },
  {
    title: 'My workspaces',
    items: [
      {
        label: 'XX',
        name: 'mannnnnnnnnnnnn',
        id: 'adasd'
      },
      {
        label: 'X2',
        name: 'Roxy Time',
        id: '0348'
      },
      {
        label: 'X3',
        name: 'Roxy Time',
        id: '0881'
      }
    ]
  }
].filter(item => item.items.length)

const search = ref()
const loading = ref(false)

async function onSearch() {
  if (!search.value) return

  loading.value = true
  await sleep(10000)
  loading.value = false
}

const activeDirection = ref()
const directions = [
  { value: 'up-left', class: 'up-left' },
  { value: 'up', class: 'up' },
  { value: 'up-right', class: 'up-right' },
  { value: 'left', class: 'left' },
  { value: 'center', class: 'center' },
  { value: 'right', class: 'right' },
  { value: 'down-left', class: 'down-left' },
  { value: 'down', class: 'down' },
  { value: 'down-right', class: 'down-right' }
]

function handleDirectionDown(direction: string) {
  activeDirection.value = direction
}

function handleDirectionUp() {
  if (activeDirection.value) {
    activeDirection.value = null
  }
}

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
    <div class="direction">
      <div v-for="(direction, index) in directions" :key="index" class="direction-btn" :class="[direction.class, { 'active': activeDirection === direction.value }]"
        @mousedown="handleDirectionDown(direction.value)" @touchstart="handleDirectionDown(direction.value)" @mouseup="handleDirectionUp" @touchend="handleDirectionUp" @mouseleave="handleDirectionUp">
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.direction {
  position: relative;
  width: 150px;
  height: 150px;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(3, 1fr);
  gap: 5px;
  margin: 20px auto;

  &-btn {
    background-color: #f0f0f0;
    border-radius: 5px;
    cursor: pointer;
    transition: all 0.2s;
    display: flex;
    align-items: center;
    justify-content: center;

    &:hover {
      background-color: #e0e0e0;
    }

    &.active {
      background-color: #4CAF50;
      transform: scale(0.95);
    }
  }
}

/* 为每个方向按钮添加图标或样式 */
.up::after {
  content: "↑";
}

.down::after {
  content: "↓";
}

.left::after {
  content: "←";
}

.right::after {
  content: "→";
}

.up-left::after {
  content: "↖";
}

.up-right::after {
  content: "↗";
}

.down-left::after {
  content: "↙";
}

.down-right::after {
  content: "↘";
}

.center::after {
  content: "○";
}
</style>
