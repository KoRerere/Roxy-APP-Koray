<script setup lang="ts">
import RightClickMenu from './right-click-menu.vue';
import pagination from './pagination.vue';
import selectionOperation from './selection-operation.vue';

const props = defineProps({
  list: {
    type: Array,
    default: () => []
  },
  columns: {
    type: Object,
    default: () => ({})
  },
  operation: {
    type: Array,
    default: () => []
  }
});

import { ref } from 'vue';

const menus = ref([
  { name: '菜单项1', click: (row: any) => console.log('菜单项1', row) },
  { name: '菜单项2', click: (row: any) => console.log('菜单项2', row) },
]);

const rightClickMenu = ref<InstanceType<typeof RightClickMenu> | null>(null);
const selection = ref<any[]>([]);

const selectionChange = (value: any[]) => {
  selection.value = value
}

const headerClick = (column: any, event: Event) => {
  console.log("🚀 ~ headerClick ~ column, event", column, event)
}

const rowClick = (row: any, column: any, event: Event) => {
  console.log("🚀 ~ rowClick ~ row, column, event", row, column, event)
}

const rowContextmenu = (row: any, column: any, event: MouseEvent) => {
  console.log("🚀 ~ rowContextmenu ~ row, column, event", row, column, event)
  event.preventDefault()
  rightClickMenu.value?.open(row, event)
}
//==================================

const handleSizeChange = (val: number) => {
  console.log(`${val} items per page`)
}
const handleCurrentChange = (val: number) => {
  console.log(`current page: ${val}`)
}

</script>

<template>
  <div class="position-relative">
    <div class="header"></div>
    <el-table :data="props.list" style="width: 100%" v-bind="$attrs" @selection-change="selectionChange"
      @header-click="headerClick" @row-click="rowClick" @row-contextmenu="rowContextmenu">
      <el-table-column type="selection" width="55" />
      <el-table-column v-for="({ getText, slot, ...column }) in props.columns.data" v-bind="column">
        <template #default="scope">
          <slot :name="slot" :data="scope.row">
            <span>{{ getText?.(scope.row) || scope.row[column.key || ''] }}</span>
          </slot>
        </template>
      </el-table-column>
    </el-table>
    <RightClickMenu :menus="menus" ref="rightClickMenu" />
    <pagination @size-change="handleSizeChange" @current-change="handleCurrentChange"></pagination>
    <selection-operation :selection="selection" :operation="props.operation"
      v-show="selection.length"></selection-operation>
  </div>
</template>

<style scoped></style>