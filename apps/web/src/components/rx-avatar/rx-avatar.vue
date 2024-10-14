<script setup lang="ts">
const props = defineProps<{
  label?: string
  image?: string
}>()

const getProps = computed(() => {
  if (props.image) {
    return {
      image: props.image,
    }
  }
  else {
    return {
      label: props.label?.slice(0, 2),
    }
  }
})
</script>

<template>
  <Avatar v-bind="{ ...$attrs, getProps }" />
</template>
