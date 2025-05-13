<script setup lang="ts">
defineOptions({
  inheritAttrs: false,
})

defineProps<{
  field: any
  input: any
}>()
</script>

<template>
  <div>
    <input :value="field.value" type="hidden">
    <component :is="input.render" :name="input.name" v-bind="{ ...input.props, ...$attrs }" />
  </div>
</template>

<style scoped></style>
