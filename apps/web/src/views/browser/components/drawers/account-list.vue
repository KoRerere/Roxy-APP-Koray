<script setup>
import ryTable from '/@/components/ry-table'
import ryTag from '/@/components/ry-tag'
import actions from '/@/components/actions.vue'
import drawerContent from '/@/components/drawer-content.vue'
import inputBase from '/@/components/ry-form/input-base.vue'

const columns = [
  {
    title: '平台',
    key: 'platform',
  },
  {
    title: '账号名称',
    key: 'accountName',
  },
  {
    title: '相关简介',
    key: 'related',
    slot: 'related',
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
    platform: 'mac',
    accountName: 'mac账号',
    related: ['a', 'b', 'c'],
  })),
)

const operation = ref([
  {
    key: 'edit',
    name: '编辑',
    icon: 'mdi mdi-wifi-off',
    quick: true,
  },
  {
    key: 'edit',
    name: '编辑',
    icon: 'mdi mdi-refresh',
    quick: true,
  },
  {
    key: 'edit',
    name: '编辑',
    icon: 'mdi mdi-file-document-plus-outline',
    quick: true,
  },
])

const filters = [
  {
    label: 'city',
    name: 'city',
    value: null,
    placeholder: '选择平台',
    options: [
      { label: '所有平台', value: 'all' },
      { label: 'mac', value: 'mac' },
      { label: 'win', value: 'win' },
    ],
  },
]

const selectedProxy = ref(null)

watch(() => selectedProxy.value, (newValue) => {
  console.log(newValue)
})
</script>

<template>
  <drawer-content title="账号列表" v-bind="$attrs">
    <div class="h-full">
      <ry-table selection-mode="multiple" :data-list="dataList" :columns="columns" :show-config="false"
        :filters="filters">
        <template #header-extra>
          <input-base type="text" left-icon="mdi mdi-magnify" name="search" placeholder="search" />
        </template>
        <template #id="{ data }">
          <div class="flex items-center gap-2">
            <RadioButton v-model="selectedProxy" :input-id="`${data.id}`" name="proxy-select" :value="data.id" />
            <label class="w-full cursor-pointer" :for="`${data.id}`">{{ data.id }}</label>
          </div>
        </template>
        <template #related>
          <div class="flex items-center gap-2">
            <ry-tag>
              123
            </ry-tag>
            <ry-tag>
              +2
            </ry-tag>
          </div>
        </template>
        <template #actions>
          <actions :operation="operation" />
        </template>
      </ry-table>
    </div>
  </drawer-content>
</template>

<style lang="scss" scoped>
.button-group {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  padding: var(--spacing-2xl, 16px) var(--spacing-2xl, 16px) var(--spacing-xl, 12px) var(--spacing-2xl, 16px);
}
</style>
