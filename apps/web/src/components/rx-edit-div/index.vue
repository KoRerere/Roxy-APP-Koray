<script setup lang="ts">
import { RxSvgIcon } from '/@/components/rx-icon/'

const props = defineProps({
  modelValue: {
    type: String,
    default: undefined,
  },
  placeholder: {
    type: String,
    default: undefined,
  },
})
const emits = defineEmits(['update:modelValue'])

const myTitle = computed(() => props.modelValue || '')

const divRef = ref()
const contenteditable = ref(false)

function focusEditableDiv() {
  contenteditable.value = true
  nextTick(() => {
    const editableDiv = divRef.value
    const range = document.createRange()
    const sel = window.getSelection()
    range.selectNodeContents(editableDiv)
    range.collapse(false)
    sel!.removeAllRanges()
    sel!.addRange(range)
    editableDiv.focus()
  })
}

function divInput(ev: any) {
  emits('update:modelValue', ev.target.textContent)
}
</script>

<template>
  <div class="flex edit">
    <div ref="divRef" class="edit-text" :contenteditable="contenteditable" :data-placeholder="placeholder"
      @input="divInput" @blur="contenteditable = false">
      {{ myTitle }}
    </div>
    <RxSvgIcon class="cursor-pointer" name="base/rx_ic_edit" :size="16" @click="focusEditableDiv" />
  </div>
</template>

<style lang="scss" scoped>
.edit {
  display: flex;
  gap: 10px;

  &-text {
    position: relative;
    color: var(--Color-neutrals-600, #575d61);
    font-family: Inter;
    font-size: 14px;
    font-style: normal;
    font-weight: 600;
    line-height: normal;

    &:empty::before {
      content: attr(data-placeholder);
    }

    &:focus::after {
      content: '';
      position: absolute;
      left: 0;
      bottom: -5px;
      width: 100%;
      height: 1px;
      background-color: var(--Color-neutrals-600, #575d61);
    }
  }
}
</style>
