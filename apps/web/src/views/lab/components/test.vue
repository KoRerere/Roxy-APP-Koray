<script setup lang="ts">
const emit = defineEmits(['update', 'updates'])

function onUpdate1() {
  emit('updates', { mamba: 'wcis man!', firstname: 'wcis man!' })
}

function onUpdate2() {
  emit('update', 'wc1')
}
</script>

<template>
  <div class="flex gap-2">
    <RxButton label="value1" @click="onUpdate1" />
    <RxButton label="ddd value2" @click="onUpdate2" />
  </div>
</template>

<style scoped></style>
