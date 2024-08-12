<script setup lang="ts">
import { CopyOutlined } from '@ant-design/icons-vue';
</script>
<template>
  <a-table v-bind="$attrs">
    <template #bodyCell="{ column, record }">
      <slot :name="column.slot" :data="record">
        <span :class="column.classes">{{ column.getText?.(record) || record[column.key] }} </span>
        <CopyOutlined class="copyable" v-if="column.copyable" />
      </slot>
    </template>
  </a-table>
</template>

<style lang="scss" scoped>
.copyable {
  margin-left: 12px;
  color: orange;
}
</style>