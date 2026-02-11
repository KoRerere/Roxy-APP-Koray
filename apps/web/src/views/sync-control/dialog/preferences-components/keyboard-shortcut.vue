<script setup lang="ts">
import type { ShortcutKeyRegisterResult } from '#roxybrowser/modules/sync-control/shortcutKey'
import { upperFirst } from 'es-toolkit'

import { isWindows } from '/@/utils'
import type { PreferenceSettings } from '/@/views/sync-control/model'

type ShortcutKey = PreferenceSettings['shortcutKey']

interface KeyboardItem {
  label: string
  key: keyof ShortcutKey['windows']
  onClear: (key: KeyboardItem['key']) => void
}

// 修饰键
const modifierKeys = ['Control', 'Shift', 'Alt', 'Meta']

// https://github.com/electron/electron/blob/main/docs/api/accelerator.md
// 只允许录入功能键、导航键、空格键、字母、数字、符号
const allowedKeys = [
  // 功能键
  ...Array.from({ length: 24 }, (_, i) => `F${i + 1}`),
  // 导航键
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  // 空格键
  ' ',
  // 数字
  '0',
  '1',
  '2',
  '3',
  '4',
  '5',
  '6',
  '7',
  '8',
  '9',
  // A-Z 26个大写字母
  ...Array.from({ length: 26 }, (_, i) => String.fromCharCode(65 + i)),
  '!',
  '@',
  '#',
  '$',
  '%',
  '^',
  '&',
  '*',
  '(',
  ')',
  '-',
  '_',
  '=',
  '+',
  '[',
  ']',
  '{',
  '}',
  '\\',
  '|',
  ';',
  ':',
  '\'',
  '"',
  ',',
  '<',
  '.',
  '>',
  '/',
  '?',
]

const formData = defineModel<ShortcutKey>({ required: true })

const os = isWindows ? 'windows' : 'mac'

/** 检查快捷键是否被占用结果 */
const checkOccupiedResult = ref<ShortcutKeyRegisterResult>()

const tempFormData = computed({
  get: () => formData.value[os],
  set: (value) => {
    Object.assign(formData.value[os], value)
  },
})

const duplicateKeys = computed(() => {
  const keys = Object.values(tempFormData.value)
  return keys.filter((key, index) => key && keys.indexOf(key) !== index)
})

function onClear(key: KeyboardItem['key']) {
  tempFormData.value[key] = ''
  checkOccupiedResult.value[key] = undefined
}

/** 录入快捷键组合 */
async function handleKeydown(event: KeyboardEvent, key: KeyboardItem['key']) {
  // console.log('event', event);
  event.preventDefault()
  let keyCombination = ''

  if (event.metaKey)
    keyCombination += 'Cmd + '
  if (event.ctrlKey)
    keyCombination += 'Ctrl + '
  if (event.shiftKey)
    keyCombination += 'Shift + '
  if (event.altKey)
    keyCombination += 'Alt + '

  const keyName = event.key
  console.log('keyName', keyName)
  if (!modifierKeys.includes(keyName) && allowedKeys.includes(upperFirst(keyName))) {
    keyCombination += keyName === ' ' ? 'Space' : upperFirst(keyName)
    tempFormData.value[key] = keyCombination
  };

  console.log('keyCombination', keyCombination)

  if (!keyCombination.endsWith(' + ')) {
    // 检查当前快捷键是否被占用
    const result = await globalThis.electronAPI.send('syncControl:checkShortcutKeysIsOccupied', {
      [os]: {
        [key]: keyCombination,
      },
    })
    console.log('checkShortcutKeysIsOccupied', result)
    checkOccupiedResult.value = {
      ...checkOccupiedResult.value,
      ...result,
    }
  }
}

const keyboardItems = ref<KeyboardItem[]>([
  // {
  //   label: $t('开始同步'),
  //   key: 'startSync',
  // },
  {
    label: $t('停止同步'),
    key: 'stopSync',
  },
  {
    label: $t('显示所有窗口'),
    key: 'showAllWindows',
  },
  {
    label: $t('宫格布局'),
    key: 'gridLayout',
  },
  {
    label: $t('堆叠布局'),
    key: 'stackLayout',
  },
  // {
  //   label: $t('延迟点击 开/关'),
  //   key: 'toggleClickDelay',
  // },
  // {
  //   label: $t('延迟输入 开/关'),
  //   key: 'toggleInputDelay',
  // },
  {
    label: $t('批量输入'),
    key: 'openBatchInputDialog',
  },
  {
    label: $t('统一标签页'),
    key: 'unifiedTabs',
  },
  {
    label: $t('关闭其他标签页'),
    key: 'closeOtherTabs',
  },
  {
    label: $t('关闭当前标签页'),
    key: 'closeCurrentTab',
  },
  {
    label: $t('关闭空白标签页'),
    key: 'closeBlankTabs',
  },
  {
    label: $t('打开网址'),
    key: 'openSites',
  },
  {
    label: $t('同步窗口列表'),
    key: 'openSyncWindowList',
  },
  {
    label: $t('同步偏好设置'),
    key: 'openPreferenceSettings',
  },
].map(n => ({ ...n, onClear }) as KeyboardItem))

function isOccupied(item: KeyboardItem) {
  const target = checkOccupiedResult.value?.[item.key]
  console.debug('target', item, target)
  // console.log('checkOccupiedResult', checkOccupiedResult.value);
  return Boolean(target && target?.accelerator && target?.status === false)
}

async function checkShortcutKeysIsOccupied() {
  const isValid = Object.values(tempFormData.value).every(key => !key.endsWith(' + '))
  console.log('isValid', isValid)
  if (isValid) {
    const result = await globalThis.electronAPI.send('syncControl:checkShortcutKeysIsOccupied', toRaw(formData.value))
    console.debug('checkShortcutKeysIsOccupied', result)
    checkOccupiedResult.value = {
      ...checkOccupiedResult.value,
      ...result,
    }
  }
}

onMounted(() => {
  checkShortcutKeysIsOccupied()
})

defineExpose({
  valid() {
    console.log('tempFormData', tempFormData.value)
    return !duplicateKeys.value.length && !Object.values(checkOccupiedResult.value).some(item => item.accelerator && item.status === false)
  },
})
</script>

<template>
  <div class="keyboard-shortcut">
    <template v-for="item in keyboardItems" :key="item.key">
      <div class="form-item">
        <label class="form-item-label">{{ item.label }}</label>
        <div class="form-item-content">
          <div class="form-item-content-input">
            <InputText v-model="tempFormData[item.key]" type="text" :placeholder="$t('设置快捷键')" size="small"
                       :invalid="isOccupied(item)" @keydown="handleKeydown($event, item.key)"
            />
            <RxButton icon="base/rx_ic_delete" severity="secondary" size="xxs" outlined @click="onClear(item.key)" />
          </div>
          <template v-if="isOccupied(item)">
            <Message size="small" severity="error" variant="simple" class="error-message">
              {{ $t('和系统快捷键冲突，请调整') }}
            </Message>
          </template>
          <template v-else-if="duplicateKeys.includes(tempFormData[item.key])">
            <Message size="small" severity="error" variant="simple" class="error-message">
              {{ $t('和其他快捷键冲突，请调整') }}
            </Message>
          </template>
        </div>
      </div>
    </template>
  </div>
</template>

<style lang="scss" scoped>
.form-item-label {
  width: 120px;
  align-self: flex-start;
}

.form-item-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.form-item-content-input {
  display: flex;
  align-items: center;
  gap: 10px;
}

.error-message {
  color: var(--colors-text-text-error, #f53838);
  font-family: 'PingFang SC';
  font-size: 12px;
  font-style: normal;
  font-weight: 400;
  line-height: 20px;
}
</style>
