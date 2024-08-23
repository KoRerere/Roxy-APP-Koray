<script setup lang="ts">

</script>

<template>
  <div class="box">
    <div class="header" />
    <div class="content">
      <div class="son" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.box {
  width: 600px;
  height: 600px;
  background-color: gray;
  display: flex;
  flex-direction: column;
}

.header {
  height: 100px;
  background-color: skyblue;
}

.content {
  flex: 1;
  background-color: orange;

  .son {
    height: 50%;
    background-color: yellow;
  }
}
</style>
