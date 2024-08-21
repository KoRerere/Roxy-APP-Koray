<script setup lang="ts">
defineProps({
  icon: String,
})
</script>

<template>
  <Button v-bind="$attrs">
    <template v-for="(_, name) in $slots" #[name]="slotProps">
      <slot :name="name" v-bind="slotProps" />
    </template>
    <template v-if="icon" #icon>
      <span :class="icon" />
    </template>
  </Button>
</template>

<style scoped></style>
