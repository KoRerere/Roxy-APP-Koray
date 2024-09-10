<script setup lang="ts">
import inputLabel from '/@/components/ry-form/input-label.vue'

defineProps({
  inputs: {
    type: Array,
    default: () => [],
  },
})
</script>

<template>
  <ry-form :inputs="inputs">
    <template #server="{ input }">
      <div>
        <inputLabel label="Server" />
        <InputGroup>
          <template v-for="(item, index) in input.items" :key="index">
            <Select v-if="item.type === 'select'" v-bind="item" v-model="item.value" option-label="label"
              option-value="value" show-clear />
            <InputText v-else v-bind="item" v-model="item.value" type="text" />
          </template>
        </InputGroup>
      </div>
    </template>
  </ry-form>
</template>

<style scoped></style>
