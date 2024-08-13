<script setup lang="ts">
const search = ref('')
const value = ref(1)
</script>

<template>
  <a-dropdown :trigger="['click']">
    <slot name="tags" />
    <template #overlay>
      <div class="radios">
        <a-input v-model:value="search" placeholder="Search..." :bordered="false" />
        <a-radio-group v-model:value="value" class="radios-group">
          <a-radio v-for="(item, index) in [1, 2, 3]" :key="index" class="radios-group-item" :value="item">
            Option {{ item }}
          </a-radio>
        </a-radio-group>
      </div>
    </template>
  </a-dropdown>
</template>

<style lang="scss" scoped>
.radios {
  min-width: 170px;
  border-radius: 6px;
  border: 0.5px solid var(--Color-neutrals-300, #c7cdd1);
  background: var(--Color-neutrals-0, #fff);
  box-shadow:
    0px 3px 8px 0px rgba(0, 0, 0, 0.07),
    0px 2px 5px 0px rgba(0, 0, 0, 0.07),
    0px 1px 1px 0px rgba(0, 0, 0, 0.07);

  position: absolute;
  top: 0;
  left: 0;

  &-group {
    display: flex;
    padding: var(--spacing-sm, 4px);
    flex-direction: column;
    align-items: flex-start;
    align-self: stretch;
    border-top: 0.5px solid var(--Color-neutrals-300, #c7cdd1);

    &-item {
      display: flex;
      padding: 8px 10px;
      align-items: center;
      gap: var(--spacing-md, 6px);
      align-self: stretch;
    }
  }
}
</style>
