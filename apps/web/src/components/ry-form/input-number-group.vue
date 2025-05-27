<script lang="ts" setup>
const props = defineProps({
  inputs: {
    type: Array as PropType<any[]>,
    default: () => [],
  },
})

const base = ['text', 'number']
const _inputs = computed(() => props.inputs.filter(item => item.separator || base.includes(item.type)))

function parseInput(input: any) {
  const { onblur, oninput } = input

  function _oninput() {
    input.invalid = false
    oninput?.()
  }

  return {
    ...input,
    onblur,
    oninput: _oninput,
  }
}
</script>

<template>
  <div class="number-group">
    <template v-for="(item, index) in _inputs" :key="index">
      <div v-if="!item.separator" class="number-group-item">
        <input v-model="item.value" class="number-group-item-input" type="number" v-bind="parseInput(item)">
        <div v-if="item.invalid" class="number-group-item-error">
          {{ item.errorMsg }}
        </div>
      </div>
      <div v-else class="number-group-separator">
        {{ item.value || ':' }}
      </div>
    </template>
  </div>
</template>

<style lang="scss" scoped>
.number-group {
  display: flex;
  flex: 1;
  align-items: center;
  padding: 8px 8px 8px 10px;
  gap: 6px;
  min-height: 38px;
  border-radius: 6px;
  border: 1px solid var(--colors-border-border-base);
  background: var(--colors-background-bg-action);
  box-shadow: 0px 1px 2px 0px rgba(16, 24, 40, 0.05);

  &-item,
  &-separator {
    color: var(--colors-text-text-primary);
    font-size: 13px;
    line-height: 20px;
  }

  &-item {
    position: relative;
    flex: 1;

    &-input {
      font-family: inherit;
      width: 100%;
      padding: 0;
      border: none;
      background-color: var(--colors-background-bg-action);
    }

    &-error {
      position: absolute;
      left: -8px;
      top: 170%;
      color: var(--colors-text-text-error);
      z-index: 1;
    }
  }
}
</style>
