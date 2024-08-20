<script setup>
import scTable from '/@/components/sc-table'
import actions from '/@/components/actions.vue'

const _props = defineProps({
  closeDrawer: {
    type: Function,
    default: () => () => { },
  },
})

const columns = [
  {
    key: 'id',
    title: 'ID',
    slot: 'id',
  },
  {
    key: 'Proxy',
    title: '代理',
  },
  {
    key: 'Outbound_IP',
    title: '外部IP',
  },
  {
    key: 'Related_Profiles',
    title: '相关简介',
  },
  {
    key: 'Actions',
    title: '操作',
    slot: 'actions',
  },
]

const dataList = ref(
  Array.from({ length: 20 }, (_, index) => ({
    id: index,
    Proxy: 'mac',
    Outbound_IP: 'mac账号',
    Related_Profiles: 'aaaaaaaaaaa',
  })),
)

const filterConfig = reactive({
  value: 'All',
  options: [
    {
      key: 'All',
      name: 'All',
    },
    {
      key: 'SOCKS5',
      name: 'SOCKS 5',
    },
    {
      key: 'HTTP',
      name: 'HTTP',
    },
    {
      key: 'HTTPS',
      name: 'HTTPS',
    },
  ],
})

const operation = ref([
  {
    key: 'edit',
    name: '编辑',
    icon: 'mdi-wifi-off',
    quick: true,
  },
  {
    key: 'edit',
    name: '编辑',
    icon: 'mdi-refresh',
    quick: true,
  },
  {
    key: 'edit',
    name: '编辑',
    icon: 'mdi-file-document-plus-outline',
    quick: true,
  },
])

const selectedProxy = ref(null)

watch(() => selectedProxy.value, (newValue) => {
  console.log(newValue)
})
</script>

<template>
  <div class="w-full h-full">
    <div class="flex justify-between items-center drawer-title">
      <span>选择代理</span>
      <span class="cursor-pointer">x</span>
    </div>
    <div class="drawer-content">
      <sc-table :data-list="dataList" :columns="columns" :show-config="false">
        <template #header-extra>
          <div class="flex flex-auto items-center justify-between">
            <SelectButton v-model="filterConfig.value" :options="filterConfig.options" option-label="name"
              option-value="key" data-key="key" />
            <Button outlined severity="secondary">
              <span class="mdi mdi-wifi-refresh" />
              <span>Test All</span>
            </Button>
          </div>
        </template>
        <template #id="{ data }">
          <div class="flex items-center gap-2">
            <RadioButton v-model="selectedProxy" :input-id="`${data.id}`" name="proxy-select" :value="data.id" />
            <label class="w-full cursor-pointer" :for="`${data.id}`">{{ data.id }}</label>
          </div>
        </template>
        <template #actions>
          <actions :operation="operation" />
        </template>
      </sc-table>
    </div>
    <div class="flex justify-end">
      <Button label="Save selected" severity="info" @click="closeDrawer" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.drawer {
  &-title {
    padding: var(--spacing-lg, 8px) var(--spacing-2xl, 16px);
    border-bottom: 0.5px solid var(--Color-neutrals-300, #c7cdd1);
    color: var(--Colors-Text-text-primary, #171c1f);
    font-family: Inter;
    font-size: 14px;
    font-style: normal;
    font-weight: 600;
    line-height: var(--Line-Height-text-sm, 18px);
    height: 40px;
  }

  &-content {
    height: 400px;
  }
}
</style>
