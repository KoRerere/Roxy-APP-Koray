<script setup>
const links = [
  {
    icon: new URL(`/@/assets/image/android.svg`, import.meta.url).href,
    classes: '',
  },
  {
    icon: new URL(`/@/assets/image/hk.svg`, import.meta.url).href,
    classes: 'direct',
    create: true,
  },
  {
    icon: new URL(`/@/assets/image/shopify.svg`, import.meta.url).href,
    classes: 'stack',
  },
]
</script>

<template>
  <div class="flex h-full items-center profile">
    <div>uid-20</div>
    <div class="flex justify-between state">
      <div v-for="(link, index) in links" :key="index" class="flex items-center justify-center state-icons"
           :class="link.classes"
      >
        <img class="state-icons-img" :src="link.icon">
      </div>
    </div>
    <div>Untitled Profile</div>
  </div>
</template>

<style lang="scss" scoped>
$box-shadow:
  0px 4px 4px -1px rgba(0, 0, 0, 0.02),
  0px 1px 1px 0px rgba(0, 0, 0, 0.06);

.profile {
  gap: var(--spacing-xl, 12px);
}

.state {
  width: 104px;

  &-icons {
    position: relative;
    padding: 3px;
    width: 24px;
    height: 24px;
    border-radius: 4px;
    border: 0.5px solid var(--Colors-Border-border-action-secondary, #c7cdd1);
    background: var(--Colors-Background-bg-action-secondary, #fff);
    box-shadow: $box-shadow;

    &-img {
      width: 100%;
      height: 100%;
    }
  }
}

.stack {
  position: relative;
  width: 20px;
  height: 20px;
  transform-style: preserve-3d;

  &::before {
    content: '';
    position: absolute;
    top: 3px;
    left: 3px;
    width: 100%;
    height: 100%;
    border-radius: 4px;
    border: 0.5px solid var(--Component-Colors-Buttons-Secondary-border, #c7cdd1);
    background: var(--Colors-Background-bg-inactive, #fafbfc);
    box-shadow: $box-shadow;
    transform: translateZ(-1px);
  }
}

.direct {
  transform: scale(0.7);
}
</style>
