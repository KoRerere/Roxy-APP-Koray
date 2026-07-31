<script setup lang="ts">
import Extensions from '/@/views/extensions/index.vue'
</script>

<template>
  <div class="flex flex-col w-full h-full">
    <ViewsHeader />
    <div class="flex-1 overflow-hidden">
      <Extensions mode="plugin" />
    </div>
  </div>
</template>
