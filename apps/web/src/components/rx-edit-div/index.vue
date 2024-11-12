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
  <div class="flex cursor-pointer editdiv" @click="focusEditableDiv">
    <div ref="divRef" class="editdiv-text" :contenteditable="contenteditable" :data-placeholder="placeholder" @input="divInput" @blur="contenteditable = false">
      {{ myTitle }}
    </div>
    <RxSvgIcon class="editdiv-icon" name="base/rx_ic_edit" color="#A3A9AD" />
  </div>
</template>

<style lang="scss" scoped>
.editdiv {
  display: flex;
  gap: 10px;
  padding: var(--spacing-md, 6px) 8px;
  transition: background 0.3s ease-in-out;

  &:hover {
    background: var(--Color-neutrals-100, #f0f3f5);
  }

  &:has([contenteditable='true']) {
    background: var(--Color-neutrals-100, #f0f3f5);

    .editdiv-icon {
      display: none;
    }
  }

  &-text {
    position: relative;
    color: var(--Color-neutrals-600, #575d61);
    font-family: Inter;
    font-size: 14px;
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
