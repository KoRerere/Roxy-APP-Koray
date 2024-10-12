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
    input.errorMsg = ''
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
        <div class="number-group-item-error">
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
  border-radius: var(--Component-Colors-TextInput-radius-radius-md, 6px);
  border: 1px solid var(--Component-Colors-TextInput-border-border, #c7cdd1);
  background: var(--Component-Colors-TextInput-bg-bg, #fff);
  box-shadow: 0px 1px 2px 0px rgba(16, 24, 40, 0.05);

  &-item,
  &-separator {
    color: var(--Component-Colors-TextInput-text-text, #171c1f);
    font-family: 'JetBrains Mono';
    font-size: 13px;
    line-height: var(--Line-Height-text-lg, 20px);
  }

  &-item {
    position: relative;
    flex: 1;

    &-input {
      width: 100%;
      padding: 0;
      border: none;
      background-color: #fff;
    }

    &-error {
      position: absolute;
      left: 0;
      bottom: -140%;
      width: 1000%;
      color: var(--Component-Colors-TextInput-error-error, #ff4d4f);
    }
  }
}
</style>
