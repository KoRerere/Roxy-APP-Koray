<script lang="ts" setup>
import type { CSSProperties } from 'vue'
import { defineComponent, provide } from 'vue'
import { useEventListener, useScrollLock } from '@vueuse/core'
import MInputText from './m-input-text.vue'
import type { SvgNames } from '/@/components/rx-icon'
import { isLikeFunction } from '/@/utils'

defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<Props>(), {
  optionLabel: 'label',
  size: 'sm',
  iconColor: 'var(--colors-text-text-primary, #171c1f)',
  darkMode: false,
  showClear: false,
  checkmark: false,
  highlightOnSelect: true,
  scrollHeight: '14rem',
  filterMatchMode: 'contains',
  editable: false,
  filter: false,
  overlayAutoWidth: false,
})

const emit = defineEmits<{
  (event: 'update:modelValue', value: any): void
  (event: 'focus', value: FocusEvent): void
  (event: 'blur', value: FocusEvent): void
  (event: 'beforeShow'): void
  (event: 'beforeHide'): void
  (event: 'show'): void
  (event: 'hide'): void
}>()

/**
 * 阻断外层 FormField 注入。
 * PrimeVue InputText 会继承 $pcFormField，把对象字段值同步进搜索框。
 */
const FormFieldIsolate = defineComponent({
  name: 'FormFieldIsolate',
  setup(_, { slots }) {
    provide('$pcFormField', null)
    return () => slots.default?.()
  },
})

type OptionResolver<T> = string | ((data: any) => T)

interface Props {
  modelValue?: any
  defaultValue?: any
  name?: string
  options?: any[]
  optionLabel?: OptionResolver<string>
  optionValue?: OptionResolver<any>
  optionDisabled?: OptionResolver<boolean>
  placeholder?: string
  disabled?: boolean
  invalid?: boolean
  showClear?: boolean
  checkmark?: boolean
  /** 为 false 时不在列表中高亮已选项 */
  highlightOnSelect?: boolean
  emptyMessage?: string
  scrollHeight?: string
  appendTo?: 'body' | 'self' | string | HTMLElement
  inputId?: string
  tabindex?: number | string
  ariaLabel?: string
  ariaLabelledby?: string
  overlayStyle?: Record<string, any>
  overlayClass?: string | Record<string, boolean>
  panelStyle?: Record<string, any>
  panelClass?: string | Record<string, boolean>
  /**
   * 面板按选项内容变宽（尊重选项上的固定宽度如 w-90），不超出视口。
   * 默认与 input 等宽。
   */
  overlayAutoWidth?: boolean
  /**
   * 触发器内可输入：过滤选项并允许提交自由值。
   * 与 filter 同时开启时优先走触发器输入，不再渲染面板搜索框。
   */
  editable?: boolean
  /**
   * 面板顶部搜索框（经典触发器）。
   * editable 为真时忽略，避免触发器输入与面板搜索重复。
   */
  filter?: boolean
  /** 面板搜索框占位文案 */
  filterPlaceholder?: string
  filterMatchMode?: 'contains' | 'startsWith' | 'endsWith'
  filterFields?: string[]
  filterLocale?: string
  icon?: SvgNames
  iconColor?: string
  size?: 'xxs' | 'xs' | 'sm' | 'md' | 'lg' | (string & {})
  darkMode?: boolean
  getOptions?: () => any[] | Promise<any[]>
  onChange?: (value: any) => void
}

const attrs = useAttrs()
const rootRef = useTemplateRef<HTMLElement>('root')
const triggerRef = useTemplateRef<HTMLElement>('trigger')
const inputRef = useTemplateRef<HTMLInputElement>('input')
const overlayRef = useTemplateRef<HTMLElement>('overlay')
const searchInputRef = useTemplateRef<{ focus: () => void }>('searchInput')
const formField = inject<any>('$pcFormField', null)
const bodyScrollLocked = useScrollLock(document.body)

const localOptions = ref(props.options)
const uncontrolledValue = ref(props.defaultValue)
const visible = ref(false)
/** 点击图标展开时展示全量列表，直到用户再次键入 */
const forceShowAll = ref(false)
const inputText = ref('')
/** 面板搜索框文案；与触发器 inputText 分开，避免经典模式下回写选中 label */
const panelQuery = ref('')
const focusedIndex = ref(-1)
/** 触发器是否聚焦（与展开态独立，用于蓝框） */
const focused = ref(false)
const overlayPosition = ref<Record<string, string>>({})
/** 面板层级：需高于 Drawer/Modal 等祖先 stacking context */
const overlayZIndex = ref<number>()
/** 正在按内容测量宽度，避免 ellipsis 把 scrollWidth 压回触发器宽度 */
const overlayMeasuring = ref(false)
/** 内容自适应后的面板像素宽度；关闭时清空以便下次重测 */
const overlayContentWidth = ref<number>()
/** 本次打开后的宽度下限，避免搜索空结果把面板压窄 */
const overlaySessionMinWidth = ref<number>()
const panelId = `m-select-${useId()}`
const OVERLAY_ZINDEX_BASE = 1100

/** 触发器内可输入（自由值 + 过滤） */
const searchable = computed(() => Boolean(props.editable))
/** 面板内搜索：仅经典触发器使用，避免与 editable 输入框叠两套过滤 */
const panelFilter = computed(() => Boolean(props.filter) && !searchable.value)

const resolvedOptions = computed(() => props.options ?? localOptions.value ?? [])
const fieldState = computed(() => formField?.field?.states)
const fieldProps = computed(() => formField?.field?.props ?? {})

const currentValue = computed(() => {
  if (props.modelValue !== undefined) {
    return props.modelValue
  }
  if (fieldState.value?.value !== undefined) {
    return fieldState.value.value
  }
  return uncontrolledValue.value
})

const hasValue = computed(() =>
  currentValue.value !== null
  && currentValue.value !== undefined
  && currentValue.value !== '',
)

/** 已选中且可清除时只保留清除按钮，避免箭头和 × 并排 */
const showDropdownIcon = computed(() => !(props.showClear && hasValue.value))

const rootAttrs = computed(() =>
  Object.fromEntries(
    Object.entries(attrs).filter(
      ([key]) => key !== 'class' && key !== 'style' && !key.startsWith('on'),
    ),
  ),
)

const overlayTarget = computed<string | HTMLElement>(() => {
  if (props.appendTo && props.appendTo !== 'self') {
    return props.appendTo
  }
  return 'body'
})
const shouldTeleport = computed(() => props.appendTo !== 'self')
const overlayStyle = computed((): CSSProperties => ({
  maxHeight: props.scrollHeight,
  ...(shouldTeleport.value
    ? { position: 'fixed' as const, ...overlayPosition.value }
    : { width: '100%' }),
  ...(overlayZIndex.value != null ? { zIndex: overlayZIndex.value } : {}),
  ...(props.overlayStyle ?? props.panelStyle ?? {}),
}))

function resolveField(option: any, resolver: OptionResolver<any> | undefined, fallback: any = option) {
  if (option === undefined || option === null) {
    return fallback
  }
  if (!resolver) {
    return fallback
  }
  return typeof resolver === 'function' ? resolver(option) : option?.[resolver]
}

function getOptionLabel(option: any) {
  if (option === undefined || option === null) {
    return ''
  }
  if (typeof option !== 'object') {
    return String(option)
  }
  return String(resolveField(option, props.optionLabel, option?.label ?? option))
}

function getOptionValue(option: any) {
  if (option === undefined || option === null) {
    return option
  }
  return resolveField(option, props.optionValue, option)
}

function isOptionDisabled(option: any) {
  return Boolean(resolveField(option, props.optionDisabled, false))
}

function isSameValue(a: any, b: any) {
  if (a === b) {
    return true
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    if (props.optionValue) {
      return getOptionValue(a) === getOptionValue(b)
    }
  }
  return false
}

const selectedOption = computed(() => {
  const value = currentValue.value
  if (value === null || value === undefined || value === '') {
    return null
  }
  return resolvedOptions.value.find((option) => {
    if (props.optionValue) {
      return getOptionValue(option) === value
    }
    return isSameValue(option, value)
  }) ?? null
})

/** 触发区展示文案：匹配 option 用 label，否则用原始值（自由输入） */
const displayLabel = computed(() => {
  if (selectedOption.value) {
    return getOptionLabel(selectedOption.value)
  }
  if (!hasValue.value) {
    return ''
  }
  if (typeof currentValue.value === 'object') {
    return getOptionLabel(currentValue.value)
  }
  return String(currentValue.value)
})

/** 选中项在触发区展示的图标（image 优先于 svg） */
const selectedTriggerVisual = computed(() => {
  const option = selectedOption.value
  if (!option || typeof option !== 'object') {
    return null
  }
  if (option.image || option.darkImage) {
    return {
      type: 'image' as const,
      src: props.darkMode ? (option.darkImage || option.image) : option.image,
    }
  }
  const icon = option.icon || props.icon
  if (icon) {
    return { type: 'icon' as const, name: icon as SvgNames }
  }
  return null
})

const searchFields = computed(() => {
  if (props.filterFields?.length) {
    return props.filterFields
  }
  if (typeof props.optionLabel === 'string') {
    return [props.optionLabel]
  }
  return ['label']
})

function matchFilter(option: any, query: string) {
  const q = query.toLocaleLowerCase(props.filterLocale)
  const candidates = searchFields.value.map((field) => {
    if (typeof option !== 'object' || option === null) {
      return String(option ?? '')
    }
    return String(option?.[field] ?? getOptionLabel(option))
  })
  return candidates.some((text) => {
    const hay = text.toLocaleLowerCase(props.filterLocale)
    switch (props.filterMatchMode) {
      case 'startsWith':
        return hay.startsWith(q)
      case 'endsWith':
        return hay.endsWith(q)
      default:
        return hay.includes(q)
    }
  })
}

/** 当前生效的过滤关键字：面板搜索优先，否则走触发器输入 */
const activeFilterQuery = computed(() => {
  if (panelFilter.value) {
    return panelQuery.value.trim()
  }
  if (searchable.value && !forceShowAll.value) {
    return inputText.value.trim()
  }
  return ''
})

const visibleOptions = computed(() => {
  const options = resolvedOptions.value
  const query = activeFilterQuery.value
  if (!query) {
    return options
  }
  return options.filter(option => matchFilter(option, query))
})

watch(
  resolvedOptions,
  () => {
    if (!visible.value || !props.overlayAutoWidth) {
      return
    }
    overlayContentWidth.value = undefined
    nextTick(() => updateOverlayPosition())
  },
)

watch(
  () => props.options,
  (value) => {
    if (value) {
      localOptions.value = value
    }
  },
)

watch(panelQuery, () => {
  if (!visible.value || !panelFilter.value) {
    return
  }
  focusedIndex.value = visibleOptions.value.findIndex(option => !isOptionDisabled(option))
  nextTick(() => updateOverlayPosition())
})

watch(
  [currentValue, selectedOption, searchable],
  () => {
    if (!searchable.value) {
      return
    }
    // 面板打开且用户正在过滤时，不回写覆盖输入
    if (visible.value && !forceShowAll.value) {
      return
    }
    inputText.value = displayLabel.value
  },
  { immediate: true },
)

onBeforeMount(async () => {
  if (props.getOptions && isLikeFunction(props.getOptions)) {
    localOptions.value = await props.getOptions()
  }
})

onMounted(() => {
  useEventListener(document, 'pointerdown', onDocumentPointerDown, true)
  useEventListener(window, 'resize', onOverlayViewportChange)
  useEventListener(window, 'scroll', updateOverlayPosition, {
    capture: true,
    passive: true,
  })
})

onBeforeUnmount(() => {
  bodyScrollLocked.value = false
  overlayZIndex.value = undefined
})

function getChangeProps() {
  return {
    options: resolvedOptions.value,
    optionLabel: props.optionLabel,
    optionValue: props.optionValue,
    editable: props.editable,
    filter: props.filter,
    ...Object.fromEntries(
      Object.entries(attrs).filter(([_, value]) => !isLikeFunction(value)),
    ),
  }
}

function notifyChange(value: any, originalEvent?: Event) {
  uncontrolledValue.value = value
  emit('update:modelValue', value)
  const event = { originalEvent, value, props: getChangeProps() }
  fieldProps.value.onChange?.(event)
  // 业务回调走 props.onChange；勿再 emit('change')，避免 v-bind onChange 双触发
  props.onChange?.(event)

  if (
    fieldState.value?.invalid
    && formField?.$pcForm?.validate
    && formField?.name
  ) {
    void formField.$pcForm.validate(formField.name)
  }
}

function open(options?: { showAll?: boolean, event?: Event }) {
  if (props.disabled) {
    return
  }
  if (options?.showAll === true) {
    forceShowAll.value = true
  }
  else if (options?.showAll === false) {
    forceShowAll.value = false
  }
  // 与 PrimeVue Select 一致：打开面板时同步进入 p-focus
  focused.value = true
  if (visible.value) {
    nextTick(() => updateOverlayPosition())
    return
  }
  emit('beforeShow')
  visible.value = true
  bodyScrollLocked.value = true
  panelQuery.value = ''
  focusedIndex.value = findSelectedIndex()
  nextTick(() => {
    emit('show')
  })
}

function close() {
  if (!visible.value) {
    return
  }
  emit('beforeHide')
  visible.value = false
  bodyScrollLocked.value = false
  forceShowAll.value = false
  focusedIndex.value = -1
  panelQuery.value = ''
  overlayContentWidth.value = undefined
  overlaySessionMinWidth.value = undefined
  overlayMeasuring.value = false
  emit('hide')
  // 面板搜索会把焦点从触发器抢走，onBlur 在面板仍打开时不会清 focused；
  // 等 overlay 卸掉后再看焦点是否还在触发器上，避免点空白关闭后蓝边残留。
  nextTick(() => {
    if (!isFocusWithinComponent()) {
      focused.value = false
    }
  })
}

function toggle(event: MouseEvent, showAll = false) {
  if (visible.value && !showAll) {
    close()
  }
  else if (visible.value && showAll) {
    open({ showAll: true, event })
  }
  else {
    open({ showAll, event })
  }
}

function findSelectedIndex() {
  if (!selectedOption.value) {
    return -1
  }
  return visibleOptions.value.findIndex(option => option === selectedOption.value)
}

function selectOption(option: any, event?: Event) {
  if (isOptionDisabled(option)) {
    return
  }
  const value = getOptionValue(option)
  inputText.value = getOptionLabel(option)
  forceShowAll.value = false
  notifyChange(value, event)
  close()
  if (searchable.value) {
    inputRef.value?.focus()
  }
  else {
    triggerRef.value?.focus()
  }
}

function clearValue(event?: MouseEvent) {
  event?.stopPropagation()
  inputText.value = ''
  forceShowAll.value = false
  notifyChange(null, event)
  close()
  if (searchable.value) {
    inputRef.value?.focus()
  }
  else {
    triggerRef.value?.focus()
  }
}

function onClearClick(event?: MouseEvent) {
  clearValue(event)
}

/** 将当前输入作为自由值提交（无匹配 option 时） */
function commitFreeValue(event?: Event) {
  if (!searchable.value) {
    return
  }
  const text = inputText.value.trim()
  if (!text) {
    if (hasValue.value) {
      notifyChange(null, event)
    }
    return
  }
  const matched = resolvedOptions.value.find((option) => {
    if (getOptionLabel(option) === text) {
      return true
    }
    if (props.optionValue && String(getOptionValue(option)) === text) {
      return true
    }
    return false
  })
  if (matched) {
    notifyChange(getOptionValue(matched), event)
    inputText.value = getOptionLabel(matched)
  }
  else {
    notifyChange(text, event)
  }
}

function onEditableInput(event: Event) {
  const value = (event.target as HTMLInputElement).value
  inputText.value = value
  // 仅键入时关闭「展示全量」，开始按输入过滤
  forceShowAll.value = false
  open({ event })
  // 输入过程同步 model，便于表单实时校验（如 URL）
  notifyChange(value, event)
  focusedIndex.value = visibleOptions.value.findIndex(option => !isOptionDisabled(option))
}

function onEditableFocus(event: FocusEvent) {
  focused.value = true
  emit('focus', event)
}

/** 单击输入框展开全量选项；过滤只在用户真正输入时发生 */
function onEditableClick(event: MouseEvent) {
  event.stopPropagation()
  open({ showAll: true, event })
}

function onClassicFocus(event: FocusEvent) {
  focused.value = true
  emit('focus', event)
}

function onTriggerClick(event: MouseEvent) {
  if (props.disabled) {
    return
  }
  if (searchable.value) {
    open({ showAll: true, event })
    inputRef.value?.focus()
    return
  }
  toggle(event)
}

function onDropdownIconClick(event: MouseEvent) {
  event.preventDefault()
  event.stopPropagation()
  if (props.disabled) {
    return
  }
  if (searchable.value) {
    if (visible.value && forceShowAll.value) {
      close()
    }
    else {
      open({ showAll: true, event })
    }
    inputRef.value?.focus()
    return
  }
  toggle(event)
}

function moveFocus(delta: number) {
  const options = visibleOptions.value
  if (!options.length) {
    focusedIndex.value = -1
    return
  }
  let next = focusedIndex.value
  const start = next
  do {
    next = next < 0
      ? (delta > 0 ? 0 : options.length - 1)
      : (next + delta + options.length) % options.length
  } while (isOptionDisabled(options[next]) && next !== start)
  focusedIndex.value = next
  nextTick(() => scrollFocusedIntoView())
}

function scrollFocusedIntoView() {
  if (focusedIndex.value < 0) {
    return
  }
  overlayRef.value
    ?.querySelector<HTMLElement>(`[data-option-index="${focusedIndex.value}"]`)
    ?.scrollIntoView({ block: 'nearest' })
}

function onTriggerKeydown(event: KeyboardEvent) {
  if (props.disabled) {
    return
  }

  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault()
      if (!visible.value) {
        open({ showAll: searchable.value, event })
      }
      else {
        moveFocus(1)
      }
      break
    case 'ArrowUp':
      event.preventDefault()
      if (!visible.value) {
        open({ showAll: searchable.value, event })
      }
      else {
        moveFocus(-1)
      }
      break
    case 'Home':
      if (visible.value) {
        event.preventDefault()
        focusedIndex.value = visibleOptions.value.findIndex(o => !isOptionDisabled(o))
        nextTick(() => scrollFocusedIntoView())
      }
      break
    case 'End':
      if (visible.value) {
        event.preventDefault()
        for (let i = visibleOptions.value.length - 1; i >= 0; i--) {
          if (!isOptionDisabled(visibleOptions.value[i])) {
            focusedIndex.value = i
            break
          }
        }
        nextTick(() => scrollFocusedIntoView())
      }
      break
    case 'Enter':
      event.preventDefault()
      if (visible.value && focusedIndex.value >= 0) {
        selectOption(visibleOptions.value[focusedIndex.value], event)
      }
      else if (searchable.value) {
        commitFreeValue(event)
        close()
      }
      else if (!visible.value) {
        open({ event })
      }
      break
    case 'Escape':
      if (visible.value) {
        event.preventDefault()
        close()
        if (searchable.value) {
          inputText.value = displayLabel.value
        }
      }
      break
    case 'Tab':
      if (searchable.value) {
        commitFreeValue(event)
      }
      close()
      break
    case ' ':
      // 面板搜索框需要空格输入，不能当选中快捷键
      if (!searchable.value && !isTypingTarget(event.target)) {
        event.preventDefault()
        if (visible.value && focusedIndex.value >= 0) {
          selectOption(visibleOptions.value[focusedIndex.value], event)
        }
        else {
          open({ event })
        }
      }
      break
    default:
      break
  }
}

/** 面板搜索等原生输入框正在键入时，不拦截空格等按键 */
function isTypingTarget(target: EventTarget | null) {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement
}

function onDocumentPointerDown(event: PointerEvent) {
  if (!visible.value) {
    return
  }
  const target = event.target as Node
  if (!rootRef.value?.contains(target) && !overlayRef.value?.contains(target)) {
    if (searchable.value) {
      commitFreeValue(event)
    }
    close()
    if (searchable.value) {
      inputText.value = displayLabel.value
    }
  }
}

/**
 * Teleport 到 body 后脱离抽屉 DOM，需按触发器祖先的 z-index 上浮，
 * 否则会被 PrimeVue Drawer mask（autoZIndex/modal）盖住。
 */
function resolveOverlayZIndex() {
  let highest = OVERLAY_ZINDEX_BASE
  let current: HTMLElement | null = rootRef.value
  while (current && current !== document.documentElement) {
    const z = Number.parseInt(getComputedStyle(current).zIndex, 10)
    if (!Number.isNaN(z)) {
      highest = Math.max(highest, z)
    }
    current = current.parentElement
  }
  return highest + 1
}

function onOverlayEnter() {
  overlayZIndex.value = resolveOverlayZIndex()
  overlayContentWidth.value = undefined
  overlaySessionMinWidth.value = undefined
  nextTick(() => {
    updateOverlayPosition()
    scrollFocusedIntoView()
    if (panelFilter.value) {
      searchInputRef.value?.focus()
    }
  })
}

/** 视口变化后按内容重测，避免只平移旧宽度 */
function onOverlayViewportChange() {
  overlayContentWidth.value = undefined
  updateOverlayPosition()
}

/** 先放开宽度量内容，再锁像素宽并贴齐触发器 */
function measureOverlayAutoWidth() {
  const overlay = overlayRef.value
  const root = rootRef.value
  if (!visible.value || !overlay || !root) {
    overlayMeasuring.value = false
    return
  }
  const triggerWidth = root.getBoundingClientRect().width
  const maxWidth = Math.max(triggerWidth, window.innerWidth - 16)
  const measured = Math.min(Math.max(overlay.offsetWidth, 0), maxWidth)
  overlaySessionMinWidth.value = Math.max(overlaySessionMinWidth.value ?? 0, measured)
  overlayContentWidth.value = Math.min(overlaySessionMinWidth.value, maxWidth)
  overlayMeasuring.value = false
  updateOverlayPosition()
}

function onOverlayAfterLeave() {
  overlayZIndex.value = undefined
}

function updateOverlayPosition() {
  if (!visible.value || !rootRef.value) {
    return
  }
  if (!shouldTeleport.value) {
    return
  }
  const rect = rootRef.value.getBoundingClientRect()
  const overlay = overlayRef.value
  const triggerWidth = rect.width
  const autoWidth = props.overlayAutoWidth
  if (autoWidth && overlayMeasuring.value) {
    return
  }
  if (autoWidth && overlayContentWidth.value == null) {
    overlayMeasuring.value = true
    overlayPosition.value = {
      top: `${rect.bottom + 4}px`,
      left: `${Math.max(8, rect.left)}px`,
      width: 'max-content',
      maxWidth: 'none',
    }
    nextTick(() => measureOverlayAutoWidth())
    return
  }
  const maxWidth = Math.max(triggerWidth, window.innerWidth - 16)
  const width = autoWidth
    ? (overlayContentWidth.value ?? triggerWidth)
    : triggerWidth
  const height = overlay?.offsetHeight ?? 200
  const top
    = rect.bottom + 4 + height > window.innerHeight && rect.top > height + 4
      ? rect.top - height - 4
      : rect.bottom + 4
  const left = Math.min(
    Math.max(8, rect.left),
    Math.max(8, window.innerWidth - width - 8),
  )
  overlayPosition.value = {
    top: `${Math.max(8, top)}px`,
    left: `${left}px`,
    ...(autoWidth
      ? { width: `${width}px`, maxWidth: `${maxWidth}px` }
      : { width: `${triggerWidth}px` }),
  }
}

function containsNode(node: Node | null | undefined) {
  if (!node) {
    return false
  }
  return Boolean(
    rootRef.value?.contains(node) || overlayRef.value?.contains(node),
  )
}

function isFocusWithinComponent(
  relatedTarget?: Node | null,
  activeElement: Element | null = document.activeElement,
) {
  return containsNode(relatedTarget) || containsNode(activeElement)
}

function onBlur(event: FocusEvent) {
  nextTick(() => {
    if (visible.value || isFocusWithinComponent(event.relatedTarget as Node | null)) {
      return
    }
    focused.value = false
    if (searchable.value) {
      commitFreeValue(event)
      inputText.value = displayLabel.value
    }
    fieldProps.value.onBlur?.(event)
  })
  emit('blur', event)
}

function onRootFocusOut(event: FocusEvent) {
  if (!visible.value) {
    return
  }
  if (isFocusWithinComponent(event.relatedTarget as Node | null)) {
    event.stopPropagation()
  }
}

function onOverlayFocusOut(event: FocusEvent) {
  if (!visible.value) {
    return
  }
  const relatedTarget = event.relatedTarget as Node | null
  if (isFocusWithinComponent(relatedTarget) || !relatedTarget) {
    event.stopPropagation()
  }
}

function isOptionSelected(option: any) {
  if (!props.highlightOnSelect) {
    return false
  }
  if (selectedOption.value) {
    return option === selectedOption.value
  }
  if (props.optionValue) {
    return getOptionValue(option) === currentValue.value
  }
  return isSameValue(option, currentValue.value)
}

function getOptionClass(option: any, index: number) {
  return [
    'm-input-select-option',
    {
      'is-selected': isOptionSelected(option),
      'is-focused': focusedIndex.value === index,
      'is-disabled': isOptionDisabled(option),
    },
  ]
}

defineExpose({
  open,
  close,
})
</script>

<template>
  <div ref="root" v-bind="rootAttrs" class="m-input-select w-full" :class="[
    props.size,
    {
      'is-open': visible,
      'is-searchable': searchable,
      'p-invalid': props.invalid || fieldState?.invalid,
      'p-disabled': props.disabled,
    },
    attrs.class,
  ]" :style="attrs.style" @focusout="onRootFocusOut"
  >
    <!-- 可搜索：原生 input 不走 PrimeVue FormField 绑定 -->
    <div v-if="searchable" class="m-input-select-trigger" :class="{ 'p-focus': focused || visible, 'p-disabled': props.disabled }" @click="onTriggerClick">
      <div class="selectitem m-input-select-editable">
        <template v-if="selectedTriggerVisual">
          <img v-if="selectedTriggerVisual.type === 'image'" class="selectitem__image" :src="selectedTriggerVisual.src" alt="">
          <SvgIcon v-else :name="selectedTriggerVisual.name" :color="props.iconColor" fallback="base/rx_ic_earth" />
        </template>
        <input :id="props.inputId" ref="input" type="text" class="m-input-select-input" :value="inputText" :placeholder="props.placeholder" :disabled="props.disabled" :tabindex="props.tabindex ?? 0"
               role="combobox" :aria-expanded="visible" :aria-controls="panelId" :aria-label="props.ariaLabel" :aria-labelledby="props.ariaLabelledby" autocomplete="off" @focus="onEditableFocus"
               @blur="onBlur" @input="onEditableInput" @keydown="onTriggerKeydown" @click="onEditableClick"
        >
      </div>
      <span v-if="props.showClear && hasValue" class="m-input-select-clear" role="button" tabindex="-1" @mousedown.prevent @click="clearValue">
        <slot name="clearicon" :clear-callback="onClearClick">
          <SvgIcon name="base/rx_ic_delete" :size="16" color="var(--colors-icon-icon-secondary)" />
        </slot>
      </span>
      <span v-if="showDropdownIcon" class="m-input-select-dropdown-icon" @mousedown.prevent @click="onDropdownIconClick">
        <slot name="dropdownicon">
          <SvgIcon name="base/rx_ic_chevron_down" :size="16" color="var(--colors-icon-icon-secondary)" />
        </slot>
      </span>
    </div>

    <!-- 经典：只读触发 -->
    <button v-else :id="props.inputId" ref="trigger" type="button" class="m-input-select-trigger" :class="{ 'p-focus': focused || visible, 'p-disabled': props.disabled }" :disabled="props.disabled"
            :tabindex="props.tabindex ?? 0" :name="props.name" role="combobox" :aria-expanded="visible" :aria-controls="panelId" :aria-label="props.ariaLabel" :aria-labelledby="props.ariaLabelledby"
            @click="onTriggerClick" @keydown="onTriggerKeydown" @focus="onClassicFocus" @blur="onBlur"
    >
      <span class="m-input-select-value" :class="{ 'is-placeholder': !hasValue }">
        <slot name="value" :value="selectedOption ?? currentValue" :placeholder="props.placeholder">
          <template v-if="hasValue">
            <div v-if="selectedOption" class="selectitem">
              <SvgIcon v-if="selectedOption.icon || props.icon" :name="selectedOption.icon || props.icon" :color="props.iconColor" fallback="base/rx_ic_earth" />
              <img v-if="selectedOption.image" class="selectitem__image" :src="props.darkMode ? selectedOption.darkImage : selectedOption.image">
              <div>{{ displayLabel }}</div>
              <slot name="value-extra" :value="selectedOption" />
            </div>
            <template v-else>
              {{ displayLabel }}
            </template>
          </template>
          <template v-else>
            {{ props.placeholder }}
          </template>
        </slot>
      </span>
      <span v-if="props.showClear && hasValue" class="m-input-select-clear" role="button" tabindex="-1" @mousedown.prevent @click="clearValue">
        <slot name="clearicon" :clear-callback="onClearClick">
          <SvgIcon name="base/rx_ic_delete" :size="16" color="var(--colors-icon-icon-secondary)" />
        </slot>
      </span>
      <span v-if="showDropdownIcon" class="m-input-select-dropdown-icon">
        <slot name="dropdownicon">
          <SvgIcon name="base/rx_ic_chevron_down" :size="16" color="var(--colors-icon-icon-secondary)" />
        </slot>
      </span>
    </button>

    <Teleport :to="overlayTarget" :disabled="!shouldTeleport">
      <Transition name="m-select-fade" @enter="onOverlayEnter" @after-leave="onOverlayAfterLeave">
        <div v-if="visible" :id="panelId" ref="overlay" class="m-input-select-panel" :class="[props.overlayClass, props.panelClass, { 'is-measuring': overlayMeasuring }]" :style="overlayStyle" role="presentation"
             @focusout="onOverlayFocusOut" @keydown="onTriggerKeydown"
        >
          <slot name="header" :value="currentValue" :options="resolvedOptions" :close="close" />
          <div v-if="panelFilter" class="m-input-select-filter" @click.stop @mousedown.stop>
            <FormFieldIsolate>
              <MInputText ref="searchInput" v-model="panelQuery" size="xs" pre-icon="base/rx_ic_magnify" :placeholder="props.filterPlaceholder ?? $t('搜索内容')" :form-control="{ novalidate: true }" />
            </FormFieldIsolate>
          </div>
          <div class="m-input-select-options" role="listbox">
            <div v-if="!visibleOptions.length" class="m-input-select-empty">
              <slot name="empty">
                {{ props.emptyMessage ?? $t('暂无数据') }}
              </slot>
            </div>
            <button v-for="(option, index) in visibleOptions" :key="props.optionValue ? String(getOptionValue(option)) : index" type="button" :data-option-index="index"
                    :class="getOptionClass(option, index)" :disabled="isOptionDisabled(option)" role="option" :aria-selected="isOptionSelected(option)" tabindex="-1" @mousedown.prevent
                    @mouseenter="focusedIndex = index" @click="selectOption(option, $event)"
            >
              <SvgIcon v-if="props.checkmark && isOptionSelected(option)" class="m-input-select-check" name="base/rx_ic_check" :size="14"
                       color="var(--colors-icon-icon-brand, var(--colors-text-text-brand))"
              />
              <span v-else-if="props.checkmark" class="m-input-select-check-spacer" />
              <span class="m-input-select-option-content">
                <slot name="option" :option="option" :selected="isOptionSelected(option)" :index="index">
                  <div class="selectitem">
                    <SvgIcon v-if="option.icon || props.icon" :name="option.icon || props.icon" :color="props.iconColor" fallback="base/rx_ic_earth" />
                    <img v-if="option.image" class="selectitem__image" :src="props.darkMode ? option.darkImage : option.image">
                    <div>{{ getOptionLabel(option) }}</div>
                    <slot name="option-extra" :option="option" />
                  </div>
                </slot>
              </span>
            </button>
          </div>
          <div v-if="$slots.footer" class="m-input-select-footer" @mousedown.stop>
            <slot name="footer" :value="currentValue" :options="resolvedOptions" :close="close" />
          </div>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style lang="scss" scoped>
.m-input-select {
  position: relative;
  min-width: 0;
  color: var(--select-color, var(--colors-text-text-primary, #171c1f));
  font-family: Inter, sans-serif;

  &.p-disabled {
    color: var(--select-disabled-color, var(--colors-text-text-inactive));

    .m-input-select-trigger {
      cursor: not-allowed;
      background: var(--select-disabled-background, var(--colors-background-bg-action-inactive));
    }
  }

  &.p-invalid .m-input-select-trigger {
    border-color: var(--select-invalid-border-color, var(--colors-border-border-error, #ef4444));
  }
}

.m-input-select-trigger {
  display: flex;
  align-items: center;
  gap: var(--spacing-md, 6px);
  box-sizing: border-box;
  width: 100%;
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 1px solid var(--p-inputtext-border-color, var(--colors-border-border-action, #c7cdd1));
  border-radius: inherit;
  background: var(--p-inputtext-background, var(--colors-background-bg-action, #fff));
  box-shadow: var(--p-inputtext-shadow, 0 1px 2px rgb(16 24 40 / 5%));
  color: inherit;
  font: inherit;
  line-height: inherit;
  text-align: left;
  cursor: pointer;
  outline-color: transparent;
  transition:
    background 0.2s,
    color 0.2s,
    border-color 0.2s,
    outline-color 0.2s,
    box-shadow 0.2s;

  /* 对齐 PrimeVue：.p-select:not(.p-disabled):hover / .p-inputtext:enabled:hover */
  &:not(.p-disabled):hover {
    border-color: var(--p-inputtext-hover-border-color, var(--colors-border-border-action-hover, #afb7bb));
  }

  /*
   * 对齐 PrimeVue：.p-select:not(.p-disabled).p-focus / .p-inputtext:enabled:focus
   * 必须紧跟 hover 且选择器权重与 hover 同级，否则点击时 :hover 会盖住蓝边
   */
  &:not(.p-disabled).p-focus {
    border-color: var(--p-inputtext-focus-border-color, var(--colors-border-border-brand, #11a3fd));
    box-shadow: var(--p-inputtext-focus-ring-shadow, var(--p-inputtext-shadow, 0 1px 2px rgb(16 24 40 / 5%)));
    outline: var(--p-inputtext-focus-ring-width, 0) var(--p-inputtext-focus-ring-style, none)
      var(--p-inputtext-focus-ring-color, transparent);
    outline-offset: var(--p-inputtext-focus-ring-offset, 0);
  }
}

.m-input-select-value {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  &.is-placeholder {
    color: var(--select-placeholder-color, var(--colors-text-text-secondary));
    opacity: 0.54;
  }
}

.m-input-select-editable {
  flex: 1;
  min-width: 0;
  min-height: 0;
}

.m-input-select-input {
  flex: 1;
  min-width: 0;
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  border: 0;
  outline: none;
  background: transparent;
  color: inherit;
  font: inherit;
  font-size: inherit;
  line-height: inherit;
  height: var(--select-input-line-height, var(--Line-Height-text-lg, 20px));
  cursor: text;

  &::placeholder {
    color: var(--select-placeholder-color, var(--colors-text-text-secondary));
    opacity: 0.8;
  }
}

.m-input-select-clear,
.m-input-select-dropdown-icon {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  line-height: 0;
  color: var(--colors-icon-icon-secondary);
}

.selectitem {
  flex: 1;
  display: flex;
  align-items: center;
  gap: var(--spacing-md, 6px);
  min-width: 0;
  line-height: inherit;

  &__image {
    display: block;
    flex-shrink: 0;
    width: 16px;
    height: 16px;
    aspect-ratio: 1;
    object-fit: contain;
  }
}

.lg {
  border-radius: var(--radius-lg, 8px);
  --select-input-line-height: var(--Line-Height-text-lg, 20px);

  .m-input-select-trigger {
    border-width: 1px;
    border-radius: var(--radius-lg, 8px);
    padding: 10px 10px 10px var(--spacing-xl, 12px);
    font-size: 14px;
    line-height: var(--Line-Height-text-lg, 20px);
  }

  .selectitem {
    gap: 8px;
  }
}

.md {
  border-radius: var(--radius-md, 6px);
  --select-input-line-height: var(--Line-Height-text-lg, 20px);

  .m-input-select-trigger {
    border-width: 1px;
    border-radius: var(--radius-md, 6px);
    padding: 8px 8px 8px 10px;
    font-size: 13px;
    line-height: var(--Line-Height-text-lg, 20px);
  }
}

.sm {
  border-radius: var(--radius-md, 6px);
  --select-input-line-height: var(--Line-Height-text-lg, 20px);

  .m-input-select-trigger {
    border-width: 1px;
    border-radius: var(--radius-md, 6px);
    padding: var(--spacing-md, 6px) var(--spacing-md, 6px) var(--spacing-md, 6px) 8px;
    font-size: 12px;
    line-height: var(--Line-Height-text-lg, 20px);
  }
}

.xs {
  border-radius: var(--radius-sm, 4px);
  --select-input-line-height: var(--Line-Height-text-xs, 16px);

  .m-input-select-trigger {
    border-width: 0.5px;
    border-radius: var(--radius-sm, 4px);
    padding: var(--spacing-md, 6px);
    font-size: 12px;
    line-height: var(--Line-Height-text-xs, 16px);
  }
}

.xxs {
  border-radius: var(--radius-sm, 4px);
  --select-input-line-height: var(--Line-Height-text-xs, 16px);

  .m-input-select-trigger {
    border-width: 0.5px;
    border-radius: var(--radius-sm, 4px);
    padding: var(--spacing-sm, 4px) var(--spacing-sm, 4px) var(--spacing-sm, 4px) var(--spacing-md, 6px);
    font-size: 12px;
    line-height: var(--Line-Height-text-xs, 16px);
  }
}
</style>

<style lang="scss">
.m-input-select-panel {
  z-index: var(--select-overlay-z-index, 1100);
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  padding: 0;
  overflow: hidden;
  border: 1px solid var(--select-overlay-border-color, var(--colors-border-border-subtle, #c7cdd1));
  border-radius: var(--select-overlay-border-radius, var(--radius-md, 6px));
  background: var(--select-overlay-background, var(--colors-background-bg-overlay, #fff));
  box-shadow: var(--select-overlay-shadow, 0 4px 6px -1px rgb(0 0 0 / 10%), 0 2px 4px -2px rgb(0 0 0 / 10%));
  color: var(--select-overlay-color, var(--colors-text-text-primary, #171c1f));
  font-family: Inter, sans-serif;
  font-size: 13px;
  line-height: var(--Line-Height-text-xs, 16px);

  &:not([style*='position: fixed']) {
    position: absolute;
    inset-block-start: calc(100% + 4px);
    inset-inline-start: 0;
  }

  /* 只放开 option 外壳去量内容；不要改子节点 width，否则会盖掉 w-90 等写死宽度 */
  &.is-measuring {
    .m-input-select-option,
    .m-input-select-option-content {
      width: max-content;
      min-width: max-content;
      overflow: visible;
    }
  }
}

.m-input-select-filter {
  flex-shrink: 0;
  padding: 0.25rem 0.25rem 0;
}

.m-input-select-options {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  gap: 2px;
  min-height: 0;
  padding: 0.25rem;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.m-input-select-footer {
  flex-shrink: 0;
  border-top: 1px solid var(--colors-border-border-subtle, #e5e7eb);
}

.m-input-select-option {
  display: flex;
  align-items: center;
  gap: 6px;
  box-sizing: border-box;
  width: 100%;
  margin: 0;
  padding: 6px 8px;
  border: 0;
  border-radius: var(--radius-sm, 4px);
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;

  &.is-focused,
  &:hover:not(.is-disabled) {
    background: var(--select-option-focus-background, var(--colors-background-bg-hover, #f3f4f6));
  }

  &.is-selected {
    background: var(--select-option-selected-background, var(--colors-background-bg-selected, #eef2ff));
  }

  &.is-disabled {
    color: var(--colors-text-text-inactive);
    cursor: not-allowed;
    opacity: 0.6;
  }
}

.m-input-select-option-content {
  flex: 1;
  min-width: 0;
}

.m-input-select-check,
.m-input-select-check-spacer {
  flex-shrink: 0;
  width: 14px;
  height: 14px;
}

.m-input-select-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 24px 12px;
  color: var(--colors-text-text-secondary);
  font-size: 13px;
}

.selectitem {
  display: flex;
  align-items: center;
  gap: var(--spacing-md, 6px);
  min-width: 0;

  &__image {
    display: block;
    flex-shrink: 0;
    width: 16px;
    height: 16px;
    aspect-ratio: 1;
    object-fit: contain;
  }
}

.m-select-fade-enter-active,
.m-select-fade-leave-active {
  transition:
    opacity 0.12s ease,
    transform 0.12s ease;
}

.m-select-fade-enter-from,
.m-select-fade-leave-to {
  opacity: 0;
  transform: translateY(-2px);
}
</style>
