<script setup lang="ts">
import NumberFlow from '@number-flow/vue'

const { lastValue = 0, value } = defineProps<{
  lastValue: number,
  value: number,
}>()

const currentValue = ref(lastValue)

let timer

watchEffect(() => {
  clearTimeout(timer)
  timer = setTimeout(() => {
    currentValue.value = value
  })
})

</script>

<template>
  <NumberFlow v-bind="$attrs" :value="currentValue" />
</template>
