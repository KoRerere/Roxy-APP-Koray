<script setup lang="ts">
import selectionOperation from './selection-operation.vue'
import tableFilter from './table-filter.vue'
import tableConfig from './table-config.vue'
import tableSort from './table-sort.vue'

const props = defineProps({
  dataKey: {
    type: String,
    default: 'id',
  },
  dataList: {
    type: Array,
    required: true,
    default: () => [],
  },
  columns: {
    type: Array,
    required: true,
    default: () => [],
  },
  filters: {
    type: Array,
    default: () => [],
  },
  sorts: {
    type: Array,
    default: () => [],
  },
  operation: {
    type: Array,
    default: () => [],
  },
  rowSelection: {
    type: Boolean,
    default: false,
  },
})

defineEmits(['update:columns'])

const _columns = computed<any[]>(() => props.columns.filter((item: any) => !item._hide))

const selectedProduct = ref()
const selectedCount = computed(() => selectedProduct.value?.length)

function clearSelection() {
  selectedProduct.value = []
}

function sort(data: any) {
  console.log('🚀 ~ sort ~ data:', data)
}
</script>

<template>
  <div class="position-relative flex-auto">
    <div class="flex items-center table-header">
      <table-filter :filters="filters" />
      <div class="flex-auto">
        <slot name="header" />
      </div>
      <table-config :columns="columns" @update:columns="(columns) => $emit('update:columns', columns)" />
      <table-sort :sorts="sorts" @sort="sort" />
    </div>

    <DataTable v-model:selection="selectedProduct" :value="dataList" paginator :rows="15"
               :rows-per-page-options="[5, 15, 30, 50]" scrollable scroll-height="500px" v-bind="$attrs"
    >
      <Column v-if="rowSelection" selection-mode="multiple" :data-key="dataKey" header-style="width: 3rem" />
      <Column v-for="column in _columns" :key="column.key" :field="column.key" :header="column.title">
        <template #body="{ data }">
          <slot :name="column.slot" :data="data">
            <span :class="column.classes">{{ column.getText?.(data) || data[column.key] }} </span>
          </slot>
        </template>
      </Column>
    </DataTable>
    <Transition>
      <selection-operation v-if="selectedCount > 0" :selected-count="selectedCount" :total="dataList.length"
                           :operation="operation" @clear-selection="clearSelection"
      />
    </Transition>
  </div>
</template>

<style lang="scss" scoped>
.table-header {
  height: 60px;
  gap: var(--spacing-md, 6px);
  background-color: olivedrab;
}

.copyable {
  margin-left: 12px;
  color: orange;
}

.v-enter-active,
.v-leave-active {
  transition: all 0.1s ease-in;
}

.v-enter-from,
.v-leave-to {
  opacity: 0;
}
</style>
