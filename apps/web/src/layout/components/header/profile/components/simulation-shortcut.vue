<template>
  <div class="flex items-center gap-2">
    <InputText type="text" :placeholder="$t('设置快捷键')" :invalid="invalid" @keydown="handleKeydown" v-model="shortcutKey"
      @blur="handleBlur" />
    <RxButton :label="$t('重置')" severity="secondary" outlined @click="onReset" />
  </div>
</template>

<script setup lang="ts">
import { upperFirst } from 'es-toolkit';
import { DEFAULT_SIMULATION_SHORTCUT_KEYS } from '/@/constants/simulation-default';
import { isWindows } from '/@/utils/common';
import { useToast } from 'primevue/usetoast'
import type { ToastMessageOptions } from 'primevue/toast'
import { $t } from '/@/locales'

const emit = defineEmits(['change'])
const invalid = ref(false)
const modelValue = defineModel<string>({ default: DEFAULT_SIMULATION_SHORTCUT_KEYS })
const shortcutKey = computed(() => {
  const keys = Array.isArray(modelValue.value) ? modelValue.value : modelValue.value.split(' ')
  return [isWindows ? 'Ctrl' : 'Command', ...keys].join(' + ')
})
const toast = useToast()
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
    modelValue.value = keyCombination.join(' ')
  } else {
    console.log('请先按下Ctrl或Cmd键');
  }
}

function onReset() {
  modelValue.value = DEFAULT_SIMULATION_SHORTCUT_KEYS;
  emit('change', modelValue.value)
}

function handleBlur() {
  const keyboard = 'CommandOrControl+' + modelValue.value.replace(' ', '+')
  console.log('keyboard', keyboard)
  emit('change', modelValue.value)
  // electronAPI.send('util:checkShortcutKeysIsOccupied', keyboard)
  //   .then((value: boolean) => {
  //     console.log('value', value);
  //     if (value) {
  //       emit('change', modelValue.value)
  //     } else {
  //       toast.add({
  //         severity: 'error',
  //         summary: $t('操作失败'),
  //         detail: $t('快捷键已被占用'),
  //         ...Object.assign(({ life: 3000 } as ToastMessageOptions))
  //       })
  //     }
  //   })

}
</script>

<style lang="scss" scoped>
.simulation {
  width: 100%;
  height: 100%;
}
</style>
