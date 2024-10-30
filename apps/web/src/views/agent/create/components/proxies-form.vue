<script setup lang="ts">
import inputLabel from '/@/components/ry-form/input-label.vue'
import inputNumberGroup from '/@/components/ry-form/input-number-group.vue'
import RxInputSelect from '/@/components/ry-form/rx-input-select.vue'

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
      <div class="flex flex-col">
        <inputLabel :label="input.label" />
        <div class="flex">
          <div class="w-1/3">
            <RxInputSelect v-bind="input.items[0]" v-model="input.items[0].value" />
          </div>
          <inputNumberGroup class=" !shadow-none" :inputs="input.items" />
        </div>
      </div>
    </template>
  </RyForm>
</template>

<style scoped></style>
