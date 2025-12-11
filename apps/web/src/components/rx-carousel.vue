<script setup lang="ts">

</script>

<template>
  <div class="scroll-layout">
    <div class="carousel">
      <div class="flex gap-4">
        <slot :item-class="[carousel.item, 'shrink-0']" />
      </div>
    </div>
  </div>
</template>

<style module="carousel">
.item {
  /* 滚动后会被 开始位置对齐 */
  scroll-snap-align: start;
}
</style>

<style lang="scss" scoped>
.scroll-layout {
  position: relative;
  display: grid;
  grid-template-columns: auto 1fr auto; // 左按钮 滚动内容 右按钮
}

.carousel {
  overflow-x: auto;
  scroll-behavior: smooth;
  scroll-snap-type: x mandatory; //水平滚动时 必须吸附到 snap 点
  overscroll-behavior-x: contain; //阻止滚动穿透 把滚动限制在 carousel 内部

  &::-webkit-scrollbar {
    display: none;
  }

  &::scroll-button(*) {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    inline-size: 48px;
    aspect-ratio: 1;
    border-radius: 50%;
    border: none;
    font-size: 16px;
    color: #ffffff;
    background-color: var(--colors-alpha-alpha-black-60);
    cursor: pointer;
    z-index: 1;
  }

  &::scroll-button(*):disabled {
    opacity: 0;
  }

  &::scroll-button(*):not(:disabled):is(:hover, :active) {
    background-color: var(--colors-alpha-alpha-black-70);
  }

  &::scroll-button(left) {
    content: '';
    left: 10px;
    background-image: url('/images/arrow_left.svg');
    background-repeat: no-repeat;
    background-position: center;
  }

  &::scroll-button(right) {
    content: '';
    right: 10px;
    background-image: url('/images/arrow_right.svg');
    background-repeat: no-repeat;
    background-position: center;
  }
}
</style>
