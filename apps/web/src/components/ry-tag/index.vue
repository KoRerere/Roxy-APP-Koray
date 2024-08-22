<script setup lang="ts">

</script>

<template>
  <Tag v-bind="$attrs">
    <template v-for="(_, name) in $slots" #[name]="slotProps">
      <slot :name="name" :slot-props="slotProps" />
    </template>
  </Tag>
</template>

<style scoped></style>
