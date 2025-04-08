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

const chooseRef = useTemplateRef('choose')

function toggle(event: Event) {
  chooseRef.value?.show(event)
}

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

    <div class="w-100 pa-2.5 pl-3 border-1 border-solid border-color-neutral-200 rounded-md" @click="toggle">Choose a space</div>
    <RyPopover ref="choose">
      <!-- w-100 border-1 border-solid border-color-neutral-200 rounded-md  -->
      <div class="w-100 relative flex flex-col gap-3 pa-3">
        <RxLoading v-model="loading" />
        <RxInputText v-model="search" left-icon="base/rx_ic_magnify" placeholder="Search workspace ID" :disabled="loading" @keyup.enter="onSearch">
          <template #icon>
            <SvgIcon v-show="search && !loading" class="cursor-pointer" name="base/rx_ic_delete" @click="search = ''"></SvgIcon>
          </template>
        </RxInputText>
        <div class="flex flex-col gap-6">
          <div v-for="space of spaces" :key="space.title">
            <div class="flex justify-between items-center mb-2 title">
              <div>{{ space.title }}</div>
              <div v-if="space.clear" class="flex items-center gap-1 cursor-pointer" @click="space.clear(space)">
                <SvgIcon name="base/rx_ic_bin_1"></SvgIcon>
                <span>Clear history</span>
              </div>
            </div>
            <div v-for="item of space.items" :key="item.id" class="flex items-center gap-3 pa-1.5 workspace">
              <RxAvatar :name="item.label" :size="36" color="orange" :font-size="16" />
              <div>
                <div class="workspace-name">{{ item.name }}</div>
                <div class="mt-1 workspace-id">{{ item.id }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </RyPopover>
  </div>
</template>

<style lang="scss" scoped>
.title {
  color: var(--Colors-text-text-primary, #111213);
  font-size: 12px;
  font-weight: 500;
  line-height: 20px;
}

.workspace {
  border-bottom: 1px dashed var(--Colors-border-border-inactive, #C7D1D6);

  &:last-of-type {
    border-bottom: none;
  }

  &-name {
    color: var(--Colors-text-text-primary, #111213);
    font-size: 14px;
    font-weight: 600;
    line-height: normal;
  }

  &-id {
    color: var(--Colors-text-text-tertiary, #575D60);
    font-family: "JetBrains Mono";
    font-size: 12px;
    line-height: var(--Line-Height-text-xs, 16px);
  }
}
</style>
