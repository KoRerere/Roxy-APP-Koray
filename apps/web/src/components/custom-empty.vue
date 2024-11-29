<script setup lang="ts">
const props = defineProps({
  icon: String,
  title: String,
  desc: String,
})

const modules = import.meta.glob('../assets/images/**/*', {
  query: '?url',
  import: 'default',
  eager: true,
})

console.log('modules', modules)

const imgSrc = computed(() => modules[`../assets/images/${props.icon}`])
</script>

<template>
  <div class="empty-content">
    <img v-if="icon" class="empty-img" :src="imgSrc">
    <div class="empty-info">
      <div class="empty-info-title">
        {{ title }}
      </div>
      <div class="empty-info-desc" v-html="desc" />
      <slot name="extra" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.empty-content {
  display: inline-flex;
  flex-direction: column;
  gap: var(--spacing-xl, 12px);
  max-width: var(--width-xs, 384px);
  user-select: none;
  -webkit-user-drag: none;
}

.empty-img {
  width: 90px;
  height: 90px;
  user-select: none;
  -webkit-user-drag: none;
}

.empty-info {
  display: flex;
  padding-left: var(--spacing-3xl, 20px);
  flex-direction: column;
  align-items: flex-start;
  gap: var(--spacing-xl, 12px);
  align-self: stretch;
  text-align: left;

  &-title {
    color: var(--Colors-Text-text-secondary, #575d61);
    font-family: Inter;
    font-size: 16px;
    font-weight: 500;
    line-height: normal;
  }

  &-desc {
    color: var(--Colors-Text-text-tertiary, #7c8387);
    font-family: Inter;
    font-size: 12px;
    line-height: 20px;
  }
}
</style>
