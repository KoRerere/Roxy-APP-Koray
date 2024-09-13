<script setup lang="ts">
const props = defineProps<{
  modelValue?: boolean
}>()
</script>

<template>
  <div class="rx-form">
    <Button label="Submit" @click="onSubmit" />
  </div>
</template>
