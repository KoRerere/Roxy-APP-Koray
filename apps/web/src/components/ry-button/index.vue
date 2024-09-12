<script setup lang="ts">
import { RxSvgIcon } from '/@/components/rx-icon/'

defineProps({
  icon: String,
})
</script>

<template>
  <Button v-bind="$attrs">
    <template v-if="icon" #icon>
      <RxSvgIcon :name="icon" :size="16" />
    </template>
    <template v-for="(_, name) in $slots" #[name]="slotProps">
      <slot :name="name" v-bind="slotProps" />
    </template>
  </Button>
</template>

<style scoped></style>
