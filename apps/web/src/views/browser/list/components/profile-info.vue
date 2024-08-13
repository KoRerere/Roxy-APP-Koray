<script setup>

</script>

<template>
  <div class="flex profile">
    <div>uid-20</div>
    <div class="link">
      <div class="link-item">
        <div class="icons stack">
          <img class="icons-img" src="/@/assets/image/android.svg">
        </div>
      </div>
    </div>
    <div>Untitled Profile</div>
  </div>
  <div class="scvr">
    <!-- <img src="/@/assets/image/android.svg"> -->
  </div>
</template>

<style lang="scss" scoped>
$box-shadow:
  0px 4px 4px -1px rgba(0, 0, 0, 0.02),
  0px 1px 1px 0px rgba(0, 0, 0, 0.06);

.profile {
  display: flex;
  align-items: center;
  gap: var(--spacing-xl, 12px);
}

.link {
  padding: 30px;
  min-width: 308px;
  background-color: #fff;

  &-item {
    position: relative;
    width: 48px;
    height: 48px;
  }
}

.icons {
  padding: 3.5px;
  height: 100%;
  width: 100%;
  border-radius: 4px;
  border: 0.5px solid var(--Colors-Border-border-action-secondary, #c7cdd1);
  background: var(--Colors-Background-bg-action-secondary, #fff);
  box-shadow: $box-shadow;

  &-img {
    width: 100%;
    height: 100%;
  }

  &.stack {
    position: relative;
    width: 80%;
    height: 80%;
    transform-style: preserve-3d;

    &::before {
      content: '';
      position: absolute;
      top: 5px;
      left: 5px;
      width: 100%;
      height: 100%;
      border-radius: 4px;
      border: 0.5px solid var(--Component-Colors-Buttons-Secondary-border, #c7cdd1);
      background: var(--Colors-Background-bg-inactive, #fafbfc);
      box-shadow: $box-shadow;
      transform: translateZ(-1px);
    }
  }
}
</style>
