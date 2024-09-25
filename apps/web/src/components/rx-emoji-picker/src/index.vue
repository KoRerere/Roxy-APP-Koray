<script setup lang="tsx">
import data from '@emoji-mart/data'
import { Picker } from 'emoji-mart'

let emojiInstance: Picker | null = null
const modelValue = defineModel<string>()

const op = useTemplateRef('op')
const emojiContainerRef = useTemplateRef('emojiContainer')

function onEmojiSelect(emoji: any) {
  console.log(emoji)
  modelValue.value = emoji.native
  op.value?.toggle()
}

async function showEmojiPicker(event: MouseEvent) {
  emojiInstance ||= new Picker({ data, onEmojiSelect })
  op.value?.toggle(event)
  await nextTick()
  emojiContainerRef.value?.appendChild(emojiInstance)
}
</script>

<template>
  <div v-bind="$attrs" class="cursor-pointer" @click="showEmojiPicker">
    <slot />
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
