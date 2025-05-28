<script setup lang="ts">
defineProps<{
  title?: string
  subTitle?: string
  description?: string
}>()
</script>

<template>
  <div class="sign-card-header">
    <div v-if="title" class="title">
      {{ title }}
    </div>
    <div v-if="subTitle" class="sub-title">
      {{ subTitle }}
    </div>
    <div class="description">
      <slot name="description">
        {{ description }}
      </slot>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.sign-card-header {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 4px;

  .title {
    color: var(--colors-text-text-primary, #fafafa);
    font-family: Archivo;
    font-size: 24px;
    font-style: normal;
    font-weight: 600;
    line-height: normal;
  }

  .sub-title {
    color: var(--colors-text-text-primary, #fafafa);
    font-family: Inter;
    font-size: 16px;
    font-style: normal;
    font-weight: 700;
    line-height: var(--Line-Height-text-lg, 20px);
    margin-bottom: 12px;
  }

  .description {
    color: var(--colors-text-text-tertiary, #575D60);
    font-family: Inter;
    font-size: 12px;
    font-style: normal;
    font-weight: 400;
    line-height: normal;
  }
}
</style>
