<script setup lang="ts">
defineProps({
  items: {
    type: Array as PropType<any>,
    default: () => [],
  },
})
</script>

<template>
  <InputGroup>
    <template v-for="item in items" :key="item.name">
      <DatePicker v-bind="item" v-model="item.value" class="rx-date-picker" show-button-bar date-format="yy-mm-dd" />
    </template>
  </InputGroup>
</template>

<style lang="scss" scoped>
.rx-date-picker+.rx-date-picker {
  :deep(.p-inputtext) {
    border-left: none;
  }
}
</style>
