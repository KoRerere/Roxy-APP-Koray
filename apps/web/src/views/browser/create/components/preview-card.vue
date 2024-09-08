<script setup lang="ts">
import ryButton from '/@/components/ry-button'

defineProps({
  data: {
    type: Object,
    default: () => ({}),
  },
})

defineEmits(['shuffle'])

const visible = ref(true)
</script>

<template>
  <div class="preview" :class="[visible ? '' : 'hide']">
    <div class="preview-header">
      <span class="text-4 cursor-pointer select-none mdi"
        :class="[visible ? 'mdi-arrow-collapse-right' : 'mdi-arrow-collapse-left']" @click="visible = !visible" />
      <span v-if="visible">Preview Card</span>
    </div>
    <div v-if="visible" class="preview-content">
      <div class="preview-content-list">
        <div v-for="(value, key) in data" :key="key" class="preview-content-item">
          <div class="preview-content-item-label">
            {{ key }}
          </div>
          <div class="preview-content-item-value">
            {{ value }}
          </div>
        </div>
      </div>
    </div>
    <div v-if="visible" class="preview-footer">
      <ryButton label="Shuffle profiles" icon="mdi mdi-shuffle-variant" outlined severity="secondary"
        @click="$emit('shuffle')" />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.preview {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  margin: 12px;
  margin-left: 0;
  padding: var(--spacing-lg, 8px) 0;
  gap: var(--spacing-md, 6px);
  width: 340px;
  height: calc(100% - 24px);
  border-radius: 8px;
  border: 0.5px solid var(--Colors-Border-border-container, #c7cdd1);
  background: var(--Colors-Background-bg-body, #fff);
  box-shadow:
    0px 3px 8px 0px rgba(0, 0, 0, 0.07),
    0px 2px 5px 0px rgba(0, 0, 0, 0.07),
    0px 1px 1px 0px rgba(0, 0, 0, 0.07);
  transition: all 0.2s ease-in;

  &.hide {
    width: 42px;
    height: 42px;
  }

  &-header {
    display: flex;
    flex-direction: row-reverse;
    align-self: stretch;
    align-items: center;
    justify-content: space-between;
    padding: 0 var(--spacing-xl, 12px);
    color: var(--Colors-Text-text-primary, #171c1f);
    font-family: Inter;
    font-size: 12px;
    font-style: normal;
    font-weight: 600;
    line-height: normal;
  }

  &-content {
    position: relative;
    flex: 1;
    overflow: hidden;
    word-break: break-all;

    &::after {
      content: ' ';
      position: absolute;
      left: 0;
      bottom: 0;
      width: 100%;
      height: 44px;
      background: linear-gradient(0deg, #fff 0%, rgba(255, 255, 255, 0) 100%);
    }

    &-list {
      padding: 0 var(--spacing-xl, 12px);
      width: 100%;
      height: 100%;
      overflow-y: scroll;
    }

    &-item {
      display: flex;
      padding: var(--spacing-sm, 4px) 10px;
      align-items: flex-start;
      align-self: stretch;
      gap: var(--spacing-sm, 4px);

      color: var(--Color-neutrals-800, #252a2e);
      font-family: 'DM Mono';
      font-size: 10px;
      font-style: normal;
      font-weight: 500;
      line-height: normal;

      &-label {
        width: 90px;
        word-wrap: break-word;
      }

      &-value {
        flex: 1;
      }
    }
  }

  &-footer {
    display: flex;
    align-self: stretch;
    align-items: center;
    justify-content: flex-end;
    padding: 0 var(--spacing-xl, 12px);
    height: 40px;
  }
}
</style>
