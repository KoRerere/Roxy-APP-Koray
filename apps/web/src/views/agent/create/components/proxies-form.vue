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
          <template v-for="item in input.items" :key="item.name">
            <Select v-if="item.type === 'select'" v-bind="item" v-model="item.value" class="!w-full"
              option-label="label" option-value="value" show-clear />
            <InputText v-else v-bind="item" v-model="item.value" class="!w-full" type="text" />
          </template>
        </InputGroup>
      </div>
    </template>
  </ry-form>
</template>

<style scoped></style>
