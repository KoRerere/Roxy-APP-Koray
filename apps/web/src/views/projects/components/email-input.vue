<script setup lang="ts">
import { $t } from '/@/locales'
import { validateEmail, validatePhone } from '/@/utils'

interface Email {
  value: string
  invalid: boolean
}

const {
  allowDuplicate = true,
  placeholder = $t('输入邮箱地址/手机号'),
} = defineProps<{
  allowDuplicate?: boolean
  placeholder?: string
}>()

const emailList = defineModel<Email[]>({ default: () => [] })

const inputRef = useTemplateRef('input')
const isFocused = ref(false)
const inputValue = ref('')

function addTag(raw: string) {
  const value = raw.trim()
  if (!value)
    return
  if (!allowDuplicate && emailList.value.some(tag => tag.value.includes(value)))
    return
  const invalid = !validateEmail(value) && !validatePhone(value)
  emailList.value.push({ value, invalid })
}

function confirmInput() {
  if (!inputValue.value)
    return
  addTag(inputValue.value)
  inputValue.value = ''
  nextTick(() => inputRef.value?.focus())
}

function removeTag(index: number) {
  emailList.value.splice(index, 1)
}

function onKeydown(e: KeyboardEvent) {
  if (['Enter', ',', ' '].includes(e.key)) {
    e.preventDefault()
    confirmInput()
  }

  if (e.key === 'Backspace' && !inputValue.value) {
    emailList.value.pop()
  }
}

function onPaste(e: ClipboardEvent) {
  const text = e.clipboardData?.getData('text')
  if (!text)
    return

  e.preventDefault()
  text.split(/[,;\s]+/).forEach(addTag)

  nextTick(() => inputRef.value?.focus())
}

function focusInput() {
  isFocused.value = true
  nextTick(() => inputRef.value?.focus())
}

function onBlur() {
  // 有未确认内容时不隐藏
  if (inputValue.value) {
    confirmInput()
  }
  isFocused.value = false
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-2 px-2 py-1.5 cursor-text rounded-1.5 input" @click="focusInput">
    <div v-for="(item, index) in emailList" :key="`${index}_${item.value}`" class="flex items-center h-5.5 gap-1 px-2.5 rounded-full tag" :class="{ error: item.invalid }" @click.stop>
      <span class="select-none cursor-default">{{ item.value }}</span>
      <SvgIcon class="cursor-pointer" name="base/rx_ic_delete" size="14" @mousedown.prevent @click="removeTag(index)" />
    </div>
    <input v-show="isFocused" ref="input" v-model.trim="inputValue" class="flex-1 min-w-30 border-none outline-none bg-transparent ipt" :placeholder="placeholder" @focus="isFocused = true" @blur="onBlur"
           @keydown="onKeydown" @paste="onPaste"
    >
    <span v-if="!isFocused && !emailList.length" class="pl-0.5 ipt placeholder">
      {{ placeholder }}
    </span>
  </div>
</template>

<style lang="scss" scoped>
.input {
  border: 1px solid var(--colors-border-border-action);
  background: var(--colors-background-bg-action);
}

.tag {
  color: var(--colors-text-text-primary);
  font-size: 14px;
  font-weight: 500;
  line-height: 1.5;
  border: 0.5px solid var(--colors-border-border-base);
  background: var(--colors-background-bg-action-hover);

  &.error {
    border-color: var(--button-outlined-danger-border-color);
    background: var(--component-button-ghost-bg);
    color: var(--button-outlined-danger-color);
  }
}

.ipt {
  color: var(--colors-text-text-primary);
  font-family: Inter;
  font-size: 14px;
  font-weight: 500;
  line-height: 1.5;

  &::placeholder {
    color: var(--colors-text-text-secondary);
    opacity: 0.6;
  }

  &.placeholder {
    color: var(--colors-text-text-secondary);
    opacity: 0.6;
  }
}
</style>
