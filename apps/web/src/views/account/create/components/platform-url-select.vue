<script setup lang="ts">
import { provide } from 'vue'
import TsFormSelect from '/@/views/lab/components/form/m-input-select.vue'
import {
  findSavedIconOption,
  matchPlatformIconKey,
  resolveIconKey,
  resolvePlatformIcons,
  toIconOptions,
} from './platform-select'
import type { PlatformIconValue, PlatformSelectOption } from './platform-select'

const props = withDefaults(defineProps<{
  url?: string
  icon?: string
  iconDark?: string
  options?: PlatformSelectOption[]
  darkMode?: boolean
  placeholder?: string
  /** 外部切换账号时变化，用来按新的网址和图标重新对齐，避免用户输入被冲掉 */
  syncKey?: string | number
}>(), {
  url: '',
  icon: '',
  iconDark: '',
  options: () => [],
  darkMode: false,
  placeholder: '',
  syncKey: '',
})

const emit = defineEmits<{
  'update:url': [value: string]
  'icons': [value: PlatformIconValue]
}>()

/** 嵌套在表单字段里时，不能让两个下拉写进外层同一个 FormField */
provide('$pcFormField', null)

/** 图标下拉的选项值，对应某个平台网址，只用于取图标 */
const iconKey = ref('')
/** 平台列表还没回来时用户已经改了网址，列表到达后按网址匹配，不再沿用旧图标 */
const preferUrlMatch = ref(false)
/** 已保存图标不在平台列表中，触发区直接显示原图 */
const showRawIcon = ref(false)
const iconOptions = computed(() => toIconOptions(props.options))
const selectedIcon = computed(() => iconOptions.value.find(item => item.value === iconKey.value))

/**
 * 按当前主题取图标地址。
 * 暗色图标缺失时回退到亮色，避免暗色主题下空白。
 */
function iconSrc(option?: PlatformSelectOption) {
  if (!option) {
    return ''
  }
  return props.darkMode ? (option.darkImage || option.image || '') : (option.image || '')
}

const selectedIconSrc = computed(() => iconSrc(selectedIcon.value))

/**
 * 触发区展示的图标。
 * 已保存但不在平台列表中的图标没有对应选项，仍要显示原图。
 */
const displayIconSrc = computed(() => {
  if (showRawIcon.value) {
    return props.darkMode ? (props.iconDark || props.icon || '') : (props.icon || props.iconDark || '')
  }
  return selectedIconSrc.value
})

/** 按当前网址预填图标，并标记为用户修改 */
function applyUrlMatch(url: string) {
  showRawIcon.value = false
  const key = matchPlatformIconKey(url, props.options)
  iconKey.value = key
  emit('icons', resolvePlatformIcons(key, props.options, true))
}

/**
 * 按外部传入的网址和图标对齐图标下拉。
 * 平台列表未返回时不写空图标，避免把已保存图标清掉。
 */
function alignIconKey() {
  if (!props.options.length) {
    return
  }
  if (preferUrlMatch.value) {
    preferUrlMatch.value = false
    applyUrlMatch(props.url)
    return
  }
  // 自定义图标不在列表里时保持原样，避免一打开编辑就把用户保存的图标换成网址匹配结果
  if ((props.icon || props.iconDark) && !findSavedIconOption(props.icon, props.iconDark, props.options)) {
    showRawIcon.value = true
    iconKey.value = ''
    return
  }
  showRawIcon.value = false
  const nextKey = resolveIconKey(props.url, props.icon, props.iconDark, props.options)
  iconKey.value = nextKey
  const icons = resolvePlatformIcons(nextKey, props.options, false)
  if (icons.platformIcon === (props.icon || '') && icons.platformIconDark === (props.iconDark || '')) {
    return
  }
  emit('icons', icons)
}

watch(() => props.options, () => {
  alignIconKey()
}, { immediate: true })

watch(() => props.syncKey, () => {
  alignIconKey()
})

/** 网址变化只预填图标，不限制用户之后再改图标 */
function onUrlChange(value: unknown) {
  const next = typeof value === 'string' ? value : ''
  emit('update:url', next)
  if (!props.options.length) {
    preferUrlMatch.value = true
    return
  }
  applyUrlMatch(next)
}

/** 图标可以和当前网址不属于同一个平台 */
function onIconChange(value: unknown) {
  showRawIcon.value = false
  const next = typeof value === 'string' ? value : ''
  iconKey.value = next
  emit('icons', resolvePlatformIcons(next, props.options, true))
}
</script>

<template>
  <div class="platform-url-select">
    <TsFormSelect class="platform-url-select__icon" :model-value="iconKey" :options="iconOptions" option-value="value" :show-dropdown-icon="false" :dark-mode="darkMode"
                  @update:model-value="onIconChange"
    >
      <template #placeholder>
        <span class="inline-flex w-full items-center justify-center">
          <SvgIcon name="base/rx_ic_user_key" color="var(--colors-icon-icon-tertiary)" />
        </span>
      </template>
      <template #value>
        <span class="inline-flex w-full items-center justify-center">
          <img v-if="displayIconSrc" class="selectitem__image" :src="displayIconSrc" alt="">
          <SvgIcon v-else name="base/rx_ic_user_key" color="var(--colors-icon-icon-tertiary)" />
        </span>
      </template>
      <template #option="{ option }">
        <span class="inline-flex w-full items-center justify-center">
          <img v-if="iconSrc(option)" class="selectitem__image" :src="iconSrc(option)" alt="">
        </span>
      </template>
    </TsFormSelect>
    <TsFormSelect class="platform-url-select__url" :model-value="url" :options="options" option-value="value" editable :dark-mode="darkMode" :placeholder="placeholder"
                  @update:model-value="onUrlChange"
    />
  </div>
</template>

<style lang="scss" scoped>
/* 选择框根节点自带 w-full，工具类压不住，这里用更高权重把宽度定死 */
.platform-url-select {
  display: flex;
  align-items: stretch;
  width: 100%;
  min-width: 0;
}

.platform-url-select__icon.m-input-select {
  flex: 0 0 40px;
  width: 40px;
  max-width: 40px;
  border-top-right-radius: 0;
  border-bottom-right-radius: 0;
}

.platform-url-select__url.m-input-select {
  flex: 1 1 auto;
  width: auto;
  min-width: 0;
  border-top-left-radius: 0;
  border-bottom-left-radius: 0;
}

/* 类名在选择框根上，触发器是它的子节点。与 sm 输入行同高：行高 + 上下内边距 + 上下边框 */
.platform-url-select__icon.sm {
  :deep(.m-input-select-trigger) {
    box-sizing: border-box;
    height: calc(
      var(--select-input-line-height, var(--Line-Height-text-lg, 20px)) + (var(--spacing-md, 6px) * 2) + 2px
    );
    padding: var(--spacing-md, 6px);
    border-top-right-radius: 0;
    border-bottom-right-radius: 0;
    border-right-width: 1px;
  }

  :deep(.m-input-select-value) {
    display: flex;
    align-items: center;
    justify-content: center;
    height: var(--select-input-line-height, var(--Line-Height-text-lg, 20px));
  }
}

.platform-url-select__url.sm {
  :deep(.m-input-select-trigger) {
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
    border-left-width: 0;
  }

  /* 图标已在左侧，右侧触发区不再重复显示 */
  :deep(.m-input-select-editable > .selectitem__image) {
    display: none;
  }
}
</style>
