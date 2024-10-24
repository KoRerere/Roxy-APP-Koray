<script setup lang="ts">
import inputLabel from '/@/components/ry-form/input-label.vue'
import inputNumberGroup from '/@/components/ry-form/input-number-group.vue'

defineProps({
  inputs: {
    type: Array as PropType<any>,
    default: () => [],
  },
})
</script>

<template>
  <RyForm :inputs="inputs">
    <template #server="{ input }">
      <div>
        <inputLabel :label="input.label" />
        <div class="flex">
          <Select v-bind="input.items[0]" v-model="input.items[0].value" class="w-1/3" option-label="label" option-value="value" />
          <inputNumberGroup class=" !shadow-none" :inputs="input.items" />
        </div>
      </div>
    </template>
  </RyForm>
</template>

<style scoped></style>
