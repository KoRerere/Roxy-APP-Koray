<script setup lang="ts">

</script>

<template>
  <div class="flex flex-col h-full">
    <h1>this is browser view text</h1>
    <div style="background-color: aquamarine;" class="children flex-auto">
      <router-view />
    </div>
  </div>
</template>



<style lang="scss" scoped></style>