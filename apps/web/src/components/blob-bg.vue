 <script setup lang="ts">
import { RxSvgIcon } from '/@/components/rx-icon/'
 </script>

<template>
  <div class="ellipse-bg">
      <RxSvgIcon name="login/blob1" class="blue" />
      <RxSvgIcon name="login/blob2" class="purple" />
    </div>
</template>

<style lang="scss" scoped>
.ellipse-bg {
  display: flex;
  position: fixed;
  top: calc(100vh - 18vw);
  left: 0;
  right: 0;
  height: 656px;

  .blue {
   font-size: 60vw;
   position: absolute;
   top: 0;
   left: 0;
  }

  .purple {
    font-size: 60vw;
    position: absolute;
    top: 50px;
    right: 0;
  }
}
</style>
