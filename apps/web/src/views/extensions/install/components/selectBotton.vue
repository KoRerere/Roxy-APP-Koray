<template>
  <div class="select-box">

    <SelectButton v-model="size" :options="sizeOptions" v-on:change="selectItem" />

    <!-- <div class="select-item-label" v-for="item in sizeOptions" :key="item.value"
      :class="{ active: item.value === size }" @click="selectItem(item)">{{
        item.label }}</div> -->

  </div>
</template>

<script setup lang="ts">
import SelectButton from 'primevue/selectbutton';
import { ref, onMounted } from 'vue';
const props = defineProps<{}>();

const emits = defineEmits(['selectFunc']);


let size = ref('All');
const sizeOptions = ref([
  'All', "Active", "Disabled"
]);



function selectItem(item: any) {
  size.value = item.value
  emits('selectFunc', size.value)
}
</script>

<style scoped lang="scss">
.select-box {
  // display: flex;
  // padding: var(--spacing-xs, 2px);
  // align-items: center;
  // gap: var(--spacing-xs, 2px);
  // border-radius: 6px;
  // border: 0.5px solid var(--Colors-Border-border-container, #C7CDD1);
  // background: var(--Color-neutrals-50, #FAFBFC);
  cursor: pointer;

  .select-item-label {
    display: flex;
    height: 20px;
    min-width: 64px;
    padding: var(--spacing-xs, 2px) 10px;
    justify-content: center;
    align-items: center;
    gap: var(--spacing-md, 6px);
    border-radius: 4px;
    background: var(--Colors-Alpha-alpha-white-0, rgba(255, 255, 255, 0.00));
  }
}



.active {
  border-radius: 4px;
  border: 1px solid var(--Colors-Border-border-container, #C7CDD1);
  background: var(--Colors-Background-bg-body, #FFF);
  box-shadow: 0px 4px 4px -1px rgba(0, 0, 0, 0.02), 0px 1px 1px 0px rgba(0, 0, 0, 0.06);
}
</style>
