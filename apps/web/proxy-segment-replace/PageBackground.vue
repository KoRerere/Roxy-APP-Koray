<template>
  <div class="page-background" aria-hidden="true">
    <div class="page-background__base" />

    <img
      class="page-background__dots"
      src="/images/proxy-segment-replace/dot-grid.svg"
      alt=""
    >

    <img
      class="page-background__waves"
      src="/images/proxy-segment-replace/bg-gradient-light.png"
      alt=""
    >
  </div>
</template>

<style lang="scss" scoped>
.page-background {
  position: fixed;
  inset: 0;
  z-index: 0;
  overflow: hidden;
  pointer-events: none;
  background: #f5fbff;
}

.page-background__base {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, #f5fbff 0%, #f8fbfd 42%, #fff 100%);
}

.page-background__dots {
  position: absolute;
  top: 120px;
  right: 0;
  width: min(434px, 34vw);
  height: auto;
  max-height: calc(100% - 120px);
  object-fit: contain;
  object-position: top right;
}

.page-background__waves {
  position: absolute;
  left: 50%;
  bottom: 0;
  width: 100%;
  min-width: 1512px;
  height: auto;
  transform: translateX(-50%);
  object-fit: cover;
  object-position: bottom center;
}

@media (max-width: 768px) {
  .page-background__waves {
    min-width: 100%;
  }

  .page-background__dots {
    top: 96px;
    width: min(280px, 52vw);
    opacity: 0.7;
  }
}
</style>
