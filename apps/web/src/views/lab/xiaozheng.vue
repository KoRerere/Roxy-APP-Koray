<script setup lang="ts">
const currentSetp = ref('2')
const steps = [
  {
    key: '1',
  },
  {
    key: '2',
  },
  {
    key: '3',
  },
]
</script>

<template>
  <RxSteps v-model="currentSetp" :steps="steps" />
</template>
