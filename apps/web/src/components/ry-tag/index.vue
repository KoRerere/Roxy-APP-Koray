<script setup lang="ts">
defineProps({
  radius: {
    type: Boolean,
    default: false,
  },
})
</script>

<template>
  <Tag v-bind="$attrs" :class="{ 'ry-tag-radius': radius }">
    <template v-for="(_, name) in $slots" #[name]="slotProps">
      <slot :name="name" :slot-props="slotProps" />
    </template>
  </Tag>
</template>

<style scoped>
.ry-tag-radius {
  border-radius: 50%;
}
</style>
