<script setup lang="tsx">
import data from '@emoji-mart/data'
import { Picker } from 'emoji-mart'
import { RxSvgIcon } from '../../rx-icon'

const props = defineProps<{ disabled?: boolean, fallbackText?: string }>()
const modelValue = defineModel<string>()

const op = useTemplateRef('op')
const emojiContainerRef = useTemplateRef('emojiContainer')

function onEmojiSelect(emoji: any) {
  console.log(emoji)
  modelValue.value = emoji.native
  op.value?.toggle()
}

async function showEmojiPicker(event: MouseEvent) {
  if (props.disabled)
    return
  const emojiInstance = new Picker({ data, onEmojiSelect })
  op.value?.toggle(event)
  await nextTick()
  emojiContainerRef.value?.appendChild(emojiInstance)
  op.value?.alignOverlay()
}

function handleClose(e: MouseEvent) {
  e.stopPropagation()
  modelValue.value = ''
}
</script>

<template>
  <div v-bind="$attrs" :style="{ cursor: disabled ? 'not-allowed' : '' }" class="rx-emoji-picker" @click="showEmojiPicker">
    <RxSvgIcon v-if="modelValue && !disabled" name="base/rx_ic_delete" class="close-icon" @click="handleClose" />
    <slot>
      <div class="default-box">
        <div class="emoji-preview">
          <template v-if="modelValue">
            {{ modelValue }}
          </template>
          <template v-else>
            {{ fallbackText }}
          </template>
        </div>
      </div>
    </slot>
  </div>
  <Popover ref="op" :class="$style.popover">
    <div ref="emojiContainer" />
  </Popover>
</template>

<style lang="scss" module>
  .popover {
  :global(.p-popover-content) {
    padding: 0;
  }
}
</style>

<style lang="scss" scoped>
.rx-emoji-picker {
  position: relative;
  cursor: pointer;

  &:hover {
    .close-icon {
      display: block;
    }
  }
}
.close-icon {
  position: absolute;
  top: 4px;
  right: 4px;
  font-size: 10px;
  display: none;
}

.default-box {
  width: fit-content;
  display: flex;
  padding: var(--spacing-sm, 4px);
  align-items: center;
  gap: 10px;
  border-radius: var(--radius-lg, 8px);
  border: 1px solid var(--Colors-Border-border-container, #c7cdd1);

  /* shadow-sm */
  box-shadow:
    0px 4px 4px -1px rgba(0, 0, 0, 0.02),
    0px 1px 1px 0px rgba(0, 0, 0, 0.06);

  .emoji-preview {
    display: flex;
    width: 48px;
    height: 48px;
    justify-content: center;
    align-items: center;
    border-radius: var(--radius-sm, 4px);
    background: var(--Color-neutrals-100, #f0f3f5);
    border-radius: var(--radius-sm, 4px);
    background: var(--Color-neutrals-100, #f0f3f5);
    color: var(--Colors-Text-text-subtle, #c7cdd1);
    text-align: center;
    font-family: 'JetBrains Mono';
    font-size: 34px;
    font-style: normal;
    font-weight: 700;
    line-height: 28px; /* 70% */
  }
}
</style>
