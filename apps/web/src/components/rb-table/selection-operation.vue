<script setup lang="ts">
const props = defineProps({
  selection: {
    type: Array,
    default: () => [],
  },
  operation: {
    type: Array,
    default: () => [],
  }
})

</script>


<template>
  <div class="flex selection">
    <div class="selection-number">222</div>
    <div class="selection-operation">
      <div v-for="item in operation" @click="() => item.onClick(props.selection)">{{ item.label }}</div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.selection {
  position: absolute;
  bottom: 80px;
  left: 50%;
  transform: translateX(-50%);

  min-width: 400px;
  height: 36px;
  color: #ffffff;
  border-radius: 8px;
  background: #0E1214;
  box-shadow: 0px 3px 8px 0px rgba(0, 0, 0, 0.07), 0px 2px 5px 0px rgba(0, 0, 0, 0.07), 0px 1px 1px 0px rgba(0, 0, 0, 0.07);
  z-index: 1;
}
</style>