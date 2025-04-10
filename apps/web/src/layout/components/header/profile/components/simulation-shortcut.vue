<template>
  <div class="flex items-center gap-2">
    <InputText 
      type="text" 
      :placeholder="$t('设置快捷键')" 
      :invalid="invalid" 
      @keydown="handleKeydown" 
      v-model="shortcutKey"
      @blur="handleBlur"
    />
    <RxButton icon="base/rx_ic_delete" severity="secondary" outlined @click="onClear" />
  </div>
</template>

<script setup lang="ts">
import { upperFirst } from 'es-toolkit';

const emit = defineEmits(['change'])
const invalid = ref(false)
const modelValue = defineModel<string[]>({ default: [] })
const shortcutKey = computed(() => {
  return ['Ctrl', ...modelValue.value].join(' + ')
})

const modifierKeys = ['Control', 'Shift', 'Alt', 'Meta'];

const allowedKeys = [
  // 功能键
  ...Array.from({ length: 24 }, (_, i) => `F${i + 1}`),
  // 导航键
  'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
  // 空格键
  ' ',
  // 数字
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
  // A-Z 26个大写字母
  ...Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i)),
  '!', '@', '#', '$', '%', '^', '&', '*', '(', ')', '-', '_', '=', '+',
  '[', ']', '{', '}', '\\', '|', ';', ':', "'", '"', ',', '<', '.', '>', '/', '?',
];

function handleKeydown(event: KeyboardEvent) {
  event.preventDefault();

  if (event.metaKey || event.ctrlKey) {
    const keyCombination: string[] = [];

    // if (event.metaKey) keyCombination.push('Cmd');
    // if (event.ctrlKey) keyCombination.push('Ctrl');
    if (event.shiftKey) keyCombination.push('Shift');
    if (event.altKey) keyCombination.push('Alt');

    const keyName = event.key
    console.log('keyName', keyName);
    if (!modifierKeys.includes(keyName) && allowedKeys.includes(upperFirst(keyName))) {
      keyCombination.push(keyName === ' ' ? 'Space' : upperFirst(keyName));
    };

    modelValue.value = keyCombination
  } else {
    console.log('请先按下Ctrl或Cmd键');
  }
}

function onClear() {
}

function handleBlur() {
  emit('change', modelValue.value)
}
</script>

<style lang="scss" scoped>
.simulation {
  width: 100%;
  height: 100%;
}
</style>

