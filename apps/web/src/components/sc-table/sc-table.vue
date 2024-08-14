<script setup lang="ts">
import { CopyOutlined } from '@ant-design/icons-vue'
import selectionOperation from './selection-operation.vue'
import tableConfig from './table-config.vue'

const props = defineProps({
  rowKey: {
    type: String,
    default: 'key',
  },
  columns: {
    type: Array,
    required: true,
    default: () => [],
  },
  dataSource: {
    type: Array,
    required: true,
    default: () => [],
  },
  operation: {
    type: Array,
    default: () => [],
  },
})

defineEmits(['update:columns'])

const _columns = computed(() => props.columns.filter((item: any) => item._hide))

const state = reactive<{
  selectedRowKeys: (string | number)[]
}>({
      selectedRowKeys: [], // Check here to configure the default column
    })

const selectedCount = computed(() => state.selectedRowKeys.length)

function onSelectChange(selectedRowKeys: (string | number)[]) {
  state.selectedRowKeys = selectedRowKeys
}

function clearSelection() {
  const _list = props.dataSource.filter((item: any) => state.selectedRowKeys.includes(item[props.rowKey]))
  state.selectedRowKeys = []
}
</script>

<template>
  <div class="position-relative">
    <div class="flex table-header">
      <div class="flex-auto">
        <slot name="table-header" />
      </div>
      <tableConfig :columns="props.columns" @update:columns="(columns) => $emit('update:columns', columns)" />
    </div>
    <a-table :row-key="rowKey" :columns="_columns" :data-source="dataSource"
             :row-selection="{ selectedRowKeys: state.selectedRowKeys, onChange: onSelectChange }" v-bind="$attrs"
    >
      <template #bodyCell="{ column, record }">
        <slot :name="column.slot" :data="record">
          <span :class="column.classes">{{ column.getText?.(record) || record[column.key] }} </span>
          <CopyOutlined v-if="column.copyable" class="copyable" />
        </slot>
      </template>
    </a-table>
    <Transition>
      <selection-operation v-if="selectedCount > 0" :selected-count="selectedCount" :total="dataSource.length"
                           :operation="operation" @clear-selection="clearSelection"
      />
    </Transition>
  </div>
</template>

<style lang="scss" scoped>
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
