<template>
  <div class="flex items-center gap-2 relative flex-1">
    <InputText type="text" :placeholder="$t('设置快捷键')" :invalid="invalid" @keydown="handleKeydown" v-model="shortcutKey"
      @blur="handleBlur" @change="handleChange" class="w-[186px]" />

    <RxButton v-tooltip.top="$t('重置')" class="w-[48px] !min-w-auto" icon="base/rx_ic_refresh" severity="secondary"
      outlined @click="onReset" />

    <Message v-if="invalid" severity="error" size="small" variant="simple"
      class="absolute top-[calc(100%+4px)] left-[6px]">
      {{ $t('快捷键已被占用') }}
    </Message>
  </div>
</template>

<script setup lang="ts">
import { upperFirst } from 'es-toolkit';
import { DEFAULT_SIMULATION_SHORTCUT_KEYS } from '/@/constants/simulation-default';
import { isWindows } from '/@/utils/common';
import { useToast } from 'primevue/usetoast'
import { $t } from '/@/locales'

const emit = defineEmits(['change'])
const invalid = ref(false)
const modelValue = defineModel<string>({ default: DEFAULT_SIMULATION_SHORTCUT_KEYS })
const firstKey = computed(() => {
  return isWindows ? 'Ctrl' : 'Command'
})
const shortcutKey = computed(() => {
  const keys = Array.isArray(modelValue.value) ? modelValue.value : modelValue.value.split(' ')
  return [firstKey.value, ...keys].join(' + ')
})
const toast = useToast()
const modifierKeys = ['Control', 'Shift', 'Alt', 'Meta'];

// const allowedKeys = [
//   // 功能键
//   ...Array.from({ length: 24 }, (_, i) => `F${i + 1}`),
//   // 导航键
//   'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
//   // 空格键
//   ' ',
//   // 数字
//   '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
//   // A-Z 26个大写字母
//   ...Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i)),
//   '!', '@', '#', '$', '%', '^', '&', '*', '(', ')', '-', '_', '=', '+',
//   '[', ']', '{', '}', '\\', '|', ';', ':', "'", '"', ',', '<', '.', '>', '/', '?',
// ];

const allowedKeys = Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i))

function handleKeydown(event: KeyboardEvent) {
  event.preventDefault();

  if (event.metaKey || (event.ctrlKey && isWindows)) {
    const keyCombination: string[] = [];

    // if (event.metaKey) keyCombination.push('Cmd');
    // if (event.ctrlKey) keyCombination.push('Ctrl');
    if (event.shiftKey) keyCombination.push('Shift');
    // if (event.altKey) keyCombination.push('Alt');

    const keyName = event.key
    console.log('keyName', keyName);
    if (!modifierKeys.includes(keyName) && allowedKeys.includes(upperFirst(keyName))) {
      keyCombination.push(upperFirst(keyName));
    };
    modelValue.value = keyCombination.join(' ')
  } else {
    toast.add({
      severity: 'error',
      summary: $t('操作失败'),
      detail: $t(`请先按下 {firstKey} 键`, { firstKey: firstKey.value }),
      life: 3000
    })
  }
}

function onReset() {
  modelValue.value = DEFAULT_SIMULATION_SHORTCUT_KEYS;
  emit('change', modelValue.value)
}

function handleBlur() {
  const keys = modelValue.value.split(' ');
  if (!keys.length) {
    toast.add({
      severity: 'error',
      summary: $t('操作失败'),
      detail: $t('必须是 {firstKey} + 字母 或 {firstKey} + Shift + 字母', { firstKey: firstKey.value }),
      life: 3000
    })
    return
  }
  const lastKey = keys[keys.length - 1];
  if (!allowedKeys.includes(lastKey)) {
    toast.add({
      severity: 'error',
      summary: $t('操作失败'),
      detail: $t('必须是 {firstKey} + 字母 或 {firstKey} + Shift + 字母', { firstKey: firstKey.value }),
      life: 3000
    })
    return
  }
  emit('change', modelValue.value)
}

function handleChange() {
  invalid.value = true;
}

onMounted(async () => {
  try {
    const keyboard = 'CommandOrControl+' + modelValue.value.replace(' ', '+')
    const isKeyboard = await electronAPI.send('util:checkShortcutKeysIsOccupied', keyboard)
    invalid.value = !isKeyboard
  } catch (error) {

  }
})
</script>

<style lang="scss" scoped>
.simulation {
  width: 100%;
  height: 100%;
}

.description {
  color: var(--colors-text-text-tertiary, #575D60);
  font-size: 12px;
  line-height: 20px;
  /* 166.667% */
}
</style>
