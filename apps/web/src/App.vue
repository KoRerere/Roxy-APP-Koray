<script setup lang="ts">
import { RouterView } from 'vue-router'
import menus from './components/menus.vue';
</script>

<template>
  <div class="flex h-full">
    <div class="menu">
      <menus></menus>
    </div>
    <div class="flex flex-auto flex-col main">
      <div class="h-20 w-full header">1111</div>
      <div class="flex-auto content">
        <RouterView />
      </div>
    </div>
  </div>

</template>

<style>
#app {
  width: 100vw;
  height: 100vh;
}
</style>

<style lang="scss" scoped>
.menu {
  background-color: orange;
}

.header {
  background-color: yellowgreen;
}

.content {
  background-color: #cccccc;
}
</style>
