<script setup lang="ts">
import PlatformUrlSelect from './platform-url-select.vue'
import { useFormContext } from '/@/views/lab/components/form/useContext'
import type { PlatformIconValue, PlatformSelectOption } from './platform-select'

const props = withDefaults(defineProps<{
  name?: string
  options?: PlatformSelectOption[]
  darkMode?: boolean
  placeholder?: string
  icon?: string
  iconDark?: string
  syncKey?: string | number
  onIcons?: (icons: PlatformIconValue) => void
  /** 网址变化后通知外层刷新依赖平台的字段标签 */
  onUrlChange?: (url: string) => void
}>(), {
  name: 'platformUrl',
  options: () => [],
  darkMode: false,
  placeholder: '',
  icon: '',
  iconDark: '',
  syncKey: '',
})

const emit = defineEmits<{
  update: [value: string]
}>()

const { getFieldState } = useFormContext()

/** 网址存在表单字段里，图标由 PlatformUrlSelect 另行回写 */
const url = computed(() => String(getFieldState(props.name)?.value ?? ''))

/** 选择、手输和外部回填都会改表单值，标签需要跟这次网址走 */
watch(url, (value) => {
  props.onUrlChange?.(value)
})
</script>

<template>
  <PlatformUrlSelect
    :url="url"
    :icon="icon"
    :icon-dark="iconDark"
    :options="options"
    :dark-mode="darkMode"
    :placeholder="placeholder"
    :sync-key="syncKey"
    @update:url="emit('update', $event)"
    @icons="onIcons?.($event)"
  />
</template>
