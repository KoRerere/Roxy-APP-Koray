<script lang="ts" setup>
import Fuse from 'fuse.js'
import { useEventListener, useScrollLock } from '@vueuse/core'
import { defineComponent, provide } from 'vue'
import MInputText from './m-input-text.vue'
import type { SvgNames } from '/@/components/rx-icon'
import { isLikeFunction } from '/@/utils'

/** 搜索路径段上的可视图标（image 优先于 svg icon） */
interface PathSegmentVisual {
  image?: string
  darkImage?: string
  icon?: SvgNames
}

/** 搜索结果中的单级路径段（含展示文案与图标） */
interface SearchPathSegment {
  option: any
  label: string
  visual: PathSegmentVisual
}

/** 扁平化搜索条目：保留叶子节点及其完整路径，供 Fuse 检索与分段展示 */
interface FlatSearchItem {
  option: any
  level: number
  /** 从根到叶子的完整节点路径，透传给 option 插槽 */
  path: any[]
  /** 分段展示用（含各级图标），避免模板内重复解析 */
  pathSegments: SearchPathSegment[]
  pathLabels: string
}

defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<Props>(), {
  optionLabel: 'label',
  optionGroupLabel: 'label',
  size: 'sm',
  iconColor: 'var(--colors-text-text-primary, #171c1f)',
  darkMode: false,
  showClear: false,
  focusOnHover: true,
})

const emit = defineEmits<{
  (event: 'update:modelValue', value: any): void
  (event: 'valueChange', value: any): void
  (event: 'change', value: any): void
  (event: 'groupChange', value: any): void
  (event: 'beforeShow'): void
  (event: 'beforeHide'): void
  (event: 'show'): void
  (event: 'hide'): void
  (event: 'focus', value: FocusEvent): void
  (event: 'blur', value: FocusEvent): void
  (event: 'click', value: MouseEvent): void
}>()

/**
 * 阻断外层 FormField 注入。
 * PrimeVue InputText 会继承 $pcFormField，把对象字段值同步进搜索框（表现为 [object Object]）。
 */
const FormFieldIsolate = defineComponent({
  name: 'FormFieldIsolate',
  setup(_, { slots }) {
    provide('$pcFormField', null)
    return () => slots.default?.()
  },
})

type OptionResolver<T> = string | ((data: any) => T)
type OptionChildrenResolver
  = | string
    | ((data: any, level: number) => any[] | null | undefined)
type OptionLeafResolver
  = | string
    | ((
      data: any,
      context: { level: number, children: any[] },
    ) => boolean | undefined)

interface Props {
  modelValue?: any
  defaultValue?: any
  name?: string
  options?: any[]
  optionLabel?: OptionResolver<string>
  optionValue?: OptionResolver<any>
  optionDisabled?: OptionResolver<boolean>
  optionGroupLabel?: OptionResolver<string>
  optionGroupChildren?: OptionChildrenResolver | OptionChildrenResolver[]
  optionLeaf?: OptionLeafResolver
  dataKey?: string
  placeholder?: string
  breakpoint?: string
  invalid?: boolean
  disabled?: boolean
  variant?: string | null
  showClear?: boolean
  clearIcon?: string
  inputId?: string
  inputStyle?: Record<string, any>
  inputClass?: string | Record<string, boolean>
  inputProps?: Record<string, any>
  panelStyle?: Record<string, any>
  panelClass?: string | Record<string, boolean>
  panelProps?: Record<string, any>
  overlayStyle?: Record<string, any>
  overlayClass?: string | Record<string, boolean>
  overlayProps?: Record<string, any>
  appendTo?: 'body' | 'self' | string | HTMLElement
  loading?: boolean
  dropdownIcon?: string
  loadingIcon?: string
  optionGroupIcon?: string
  autoOptionFocus?: boolean
  selectOnFocus?: boolean
  focusOnHover?: boolean
  searchLocale?: string
  /** 是否启用面板内搜索 */
  filter?: boolean
  /** Fuse 检索字段，默认匹配完整路径文案 */
  filterFields?: string[]
  searchMessage?: string
  selectionMessage?: string
  emptySelectionMessage?: string
  emptySearchMessage?: string
  emptyMessage?: string
  tabindex?: number | string
  fluid?: boolean
  ariaLabelledby?: string
  ariaLabel?: string
  formControl?: Record<string, any>
  dt?: Record<string, any>
  pt?:
    | Record<string, any>
    | ((options: Record<string, any>) => Record<string, any>)
  ptOptions?: Record<string, any>
  unstyled?: boolean
  icon?: SvgNames
  iconColor?: string
  size?: 'xxs' | 'xs' | 'sm' | 'md' | 'lg' | (string & {})
  darkMode?: boolean
  getOptions?: () => any[] | Promise<any[]>
  onChange?: (value: any) => void
  /** 选中后展示完整路径，各级 label 使用该分隔符拼接 */
  pathSeparator?: string
}

const slots = useSlots()
const attrs = useAttrs()
const rootRef = useTemplateRef<HTMLElement>('root')
const triggerRef = useTemplateRef<HTMLButtonElement>('trigger')
const overlayRef = useTemplateRef<HTMLElement>('overlay')
const searchInputRef = useTemplateRef<{ focus: () => void }>('searchInput')
const formField = inject<any>('$pcFormField', null)
const bodyScrollLocked = useScrollLock(document.body)

const localOptions = ref(props.options)
const uncontrolledValue = ref(props.defaultValue)
const visible = ref(false)
const activePath = ref<any[]>([])
const searchQuery = ref('')
const focusedOption = ref({ level: 0, index: -1 })
const focusedSearchIndex = ref(-1)
const overlayPosition = ref<Record<string, string>>({})
const panelId = `m-cascade-${useId()}`

const resolvedOptions = computed(
  () => props.options ?? localOptions.value ?? [],
)
const fieldState = computed(() => formField?.field?.states)
const fieldProps = computed(() => formField?.field?.props ?? {})
const currentValue = computed(() => {
  if (props.modelValue !== undefined)
    return props.modelValue
  if (fieldState.value?.value !== undefined)
    return fieldState.value.value
  return uncontrolledValue.value
})

const rootAttrs = computed(() =>
  Object.fromEntries(
    Object.entries(attrs).filter(
      ([key]) => key !== 'class' && key !== 'style' && !key.startsWith('on'),
    ),
  ),
)

const forwardedSlots = computed(() =>
  Object.keys(slots).filter(
    name =>
      ![
        'default',
        'dropdownicon',
        'clearicon',
        'loadingicon',
        'optiongroupicon',
        'option',
        'value',
        'value-extra',
        'option-extra',
        'header',
        'footer',
      ].includes(name),
  ),
)

const selectedOption = computed(() =>
  findSelectedOption(resolvedOptions.value, currentValue.value, 0),
)
const selectedPath = computed(
  () =>
    findSelectedPath(resolvedOptions.value, currentValue.value, 0)?.parents
    ?? [],
)
const selectedDisplayPath = computed(() => {
  const found = findSelectedPath(resolvedOptions.value, currentValue.value, 0)
  if (!found)
    return []
  return [...found.parents, found.option]
})
/** 选中路径分段（含各级图标），与搜索结果展示规则一致 */
const selectedPathSegments = computed<SearchPathSegment[]>(() =>
  selectedDisplayPath.value.map((option, index) => ({
    option,
    label: getOptionText(option, index < selectedDisplayPath.value.length - 1),
    visual: getPathSegmentVisual(option),
  })),
)
const selectedDisplayText = computed(() => {
  if (!selectedOption.value)
    return ''

  if (!props.pathSeparator)
    return getOptionText(selectedOption.value)

  return selectedPathSegments.value
    .map(segment => segment.label)
    .filter(Boolean)
    .join(props.pathSeparator)
})
const levels = computed(() => {
  const result: Array<{ options: any[], parent?: any, level: number }> = [
    { options: resolvedOptions.value, level: 0 },
  ]
  activePath.value.forEach((parent, level) => {
    const children = getChildren(parent, level)
    if (children.length)
      result.push({ options: children, parent, level: level + 1 })
  })
  return result
})
const isSearchActive = computed(
  () => props.filter && searchQuery.value.trim().length > 0,
)
const flatSearchItems = computed(() =>
  flattenLeafOptions(resolvedOptions.value, 0),
)
const searchResults = computed(() => {
  const query = searchQuery.value.trim()
  if (!query || !props.filter)
    return []
  const keys = props.filterFields?.length
    ? props.filterFields
    : ['pathLabels']
  const fuse = new Fuse(flatSearchItems.value, {
    threshold: 0.3,
    keys,
    ignoreLocation: true,
  })
  return fuse.search(query).map(result => result.item)
})
const overlayTarget = computed<string | HTMLElement>(() => {
  if (props.appendTo && props.appendTo !== 'self')
    return props.appendTo
  return 'body'
})
const shouldTeleport = computed(() => props.appendTo !== 'self')
const overlayStyle = computed(() => ({
  ...(shouldTeleport.value
    ? { position: 'fixed', ...overlayPosition.value }
    : {}),
  ...(props.overlayStyle ?? props.panelStyle ?? {}),
}))
const overlayClass = computed(() => [
  'm-input-cascade-select-panel',
  props.overlayClass,
  props.panelClass,
])
const hasValue = computed(
  () =>
    currentValue.value !== null
    && currentValue.value !== undefined
    && currentValue.value !== '',
)

watch(
  () => props.options,
  (value) => {
    if (value)
      localOptions.value = value
  },
)

watch(searchQuery, (query) => {
  focusedSearchIndex.value = -1
  if (!query.trim())
    activePath.value = [...selectedPath.value]
})

onBeforeMount(async () => {
  if (props.getOptions && isLikeFunction(props.getOptions))
    localOptions.value = await props.getOptions()
})

onMounted(() => {
  useEventListener(document, 'pointerdown', onDocumentPointerDown, true)
  useEventListener(window, 'resize', updateOverlayPosition)
  useEventListener(window, 'scroll', updateOverlayPosition, {
    capture: true,
    passive: true,
  })
})

onBeforeUnmount(() => {
  bodyScrollLocked.value = false
})

function resolveOptionValue(
  option: any,
  resolver: OptionResolver<any> | undefined,
  fallback = option,
) {
  if (!resolver)
    return fallback
  return typeof resolver === 'function' ? resolver(option) : option?.[resolver]
}

function getOptionText(option: any, group = false) {
  if (option === undefined || option === null)
    return ''
  const resolver = group ? props.optionGroupLabel : props.optionLabel
  return String(resolveOptionValue(option, resolver, option?.label ?? option))
}

function getChildren(option: any, level: number) {
  const childrenResolver = props.optionGroupChildren
  const resolver = Array.isArray(childrenResolver)
    ? childrenResolver[level]
    : childrenResolver
  const value = resolver
    ? typeof resolver === 'function'
      ? resolver(option, level)
      : option?.[resolver]
    : childrenResolver === undefined
      ? option?.children
      : undefined
  return Array.isArray(value) ? value : []
}

function isLeaf(option: any, level: number) {
  const children = getChildren(option, level)
  if (!children.length)
    return true
  const resolver = props.optionLeaf
  if (!resolver)
    return false
  const value
    = typeof resolver === 'function'
      ? resolver(option, { level, children })
      : option?.[resolver]
  return value === true
}

function isGroup(option: any, level: number) {
  return !isLeaf(option, level)
}

function isOptionDisabled(option: any) {
  return Boolean(resolveOptionValue(option, props.optionDisabled, false))
}

function valuesEqual(option: any, value: any) {
  if (props.dataKey && option && value && typeof value === 'object')
    return option[props.dataKey] === value[props.dataKey]
  return resolveOptionValue(option, props.optionValue) === value
}

function findSelectedOption(
  options: any[],
  value: any,
  level: number,
): any | undefined {
  for (const option of options) {
    if (valuesEqual(option, value) && isLeaf(option, level))
      return option
    if (isGroup(option, level)) {
      const children = getChildren(option, level)
      const selected = findSelectedOption(children, value, level + 1)
      if (selected)
        return selected
    }
  }
  return undefined
}

function findSelectedPath(
  options: any[],
  value: any,
  level: number,
): { parents: any[], option: any } | undefined {
  for (const option of options) {
    if (valuesEqual(option, value) && isLeaf(option, level))
      return { parents: [], option }
    if (isGroup(option, level)) {
      const children = getChildren(option, level)
      const found = findSelectedPath(children, value, level + 1)
      if (found)
        return { parents: [option, ...found.parents], option: found.option }
    }
  }
  return undefined
}

/** 递归收集所有叶子节点及其路径文案，供 Fuse 模糊搜索 */
function flattenLeafOptions(
  options: any[],
  level: number,
  path: any[] = [],
): FlatSearchItem[] {
  const result: FlatSearchItem[] = []
  for (const option of options) {
    const currentPath = [...path, option]
    if (isLeaf(option, level)) {
      const pathSegments = currentPath.map((item, index) => ({
        option: item,
        label: getOptionText(item, index < currentPath.length - 1),
        visual: getPathSegmentVisual(item),
      }))
      result.push({
        option,
        level,
        path: currentPath,
        pathSegments,
        pathLabels: pathSegments
          .map(segment => segment.label)
          .filter(Boolean)
          .join(props.pathSeparator ?? ' / '),
      })
      continue
    }
    if (isGroup(option, level)) {
      result.push(
        ...flattenLeafOptions(getChildren(option, level), level + 1, currentPath),
      )
    }
  }
  return result
}

/**
 * 仅使用选项上已挂载的 image / icon（由业务侧按层级映射），无图标的层级不补
 */
function getPathSegmentVisual(option: any): PathSegmentVisual {
  if (!option || typeof option !== 'object')
    return {}

  if (option.image)
    return { image: option.image, darkImage: option.darkImage || option.image }

  if (option.icon)
    return { icon: option.icon as SvgNames }

  return {}
}

/** 将文案按当前搜索词拆成普通/高亮片段，便于路径段内标注匹配 */
function getHighlightedLabelParts(label: string, query: string) {
  const text = String(label ?? '')
  const keyword = query.trim()
  if (!text || !keyword)
    return [{ text, matched: false }]

  const lowerText = text.toLocaleLowerCase(props.searchLocale)
  const lowerKeyword = keyword.toLocaleLowerCase(props.searchLocale)
  const parts: Array<{ text: string, matched: boolean }> = []
  let cursor = 0

  while (cursor < text.length) {
    const matchIndex = lowerText.indexOf(lowerKeyword, cursor)
    if (matchIndex === -1) {
      parts.push({ text: text.slice(cursor), matched: false })
      break
    }
    if (matchIndex > cursor)
      parts.push({ text: text.slice(cursor, matchIndex), matched: false })
    parts.push({
      text: text.slice(matchIndex, matchIndex + keyword.length),
      matched: true,
    })
    cursor = matchIndex + keyword.length
  }

  return parts.length ? parts : [{ text, matched: false }]
}

function getPt(name: string, context: Record<string, any> = {}) {
  const pt = props.pt
  const value
    = typeof pt === 'function'
      ? pt({ props, state: { overlayVisible: visible.value }, ...context })?.[
        name
      ]
      : pt?.[name]
  const resolved
    = typeof value === 'function'
      ? value({ props, state: { overlayVisible: visible.value }, ...context })
      : value
  if (typeof resolved === 'string')
    return { class: resolved }
  return resolved ?? {}
}

function getChangeProps() {
  return {
    options: resolvedOptions.value,
    optionLabel: props.optionLabel,
    optionValue: props.optionValue,
    optionGroupLabel: props.optionGroupLabel,
    optionGroupChildren: props.optionGroupChildren,
    optionLeaf: props.optionLeaf,
    ...Object.fromEntries(
      Object.entries(attrs).filter(([_, value]) => !isLikeFunction(value)),
    ),
  }
}

function notifyChange(value: any, originalEvent: Event) {
  uncontrolledValue.value = value
  emit('update:modelValue', value)
  emit('valueChange', value)
  const event = { originalEvent, value, props: getChangeProps() }

  // 同步 PrimeVue Form 字段值
  fieldProps.value.onChange?.(event)
  // 业务回调统一走 props.onChange；不可再 emit('change')，否则 v-bind 传入的 onChange 会被 Vue 再次触发
  props.onChange?.(event)

  if (
    fieldState.value?.invalid
    && formField?.$pcForm?.validate
    && formField?.name
  ) {
    void formField.$pcForm.validate(formField.name)
  }
}

function open(event?: Event) {
  if (props.disabled || visible.value)
    return
  emit('beforeShow')
  searchQuery.value = ''
  focusedSearchIndex.value = -1
  activePath.value = [...selectedPath.value]
  visible.value = true
  bodyScrollLocked.value = true
  nextTick(() => {
    updateOverlayPosition()
    if (props.filter)
      searchInputRef.value?.focus()
    else if (props.autoOptionFocus)
      focusFirstOption()
    emit('show')
  })
  if (event)
    emit('click', event as MouseEvent)
}

function close() {
  if (!visible.value)
    return
  emit('beforeHide')
  visible.value = false
  bodyScrollLocked.value = false
  searchQuery.value = ''
  focusedOption.value = { level: 0, index: -1 }
  focusedSearchIndex.value = -1
  emit('hide')
}

function toggle(event: MouseEvent) {
  if (visible.value)
    close()
  else open(event)
}

function expandGroup(
  option: any,
  level: number,
  event?: MouseEvent | KeyboardEvent,
) {
  if (isOptionDisabled(option) || !isGroup(option, level))
    return
  activePath.value = [...activePath.value.slice(0, level), option]
  const groupEvent = {
    originalEvent: event,
    value: resolveOptionValue(option, props.optionValue),
    props: getChangeProps(),
  }
  emit('groupChange', groupEvent)
}

/** hover 展开分组；click 仅选中叶子节点 */
function onOptionMouseEnter(option: any, level: number, index: number) {
  if (props.focusOnHover)
    focusedOption.value = { level, index }
  if (isGroup(option, level))
    expandGroup(option, level)
}

function onOptionClick(
  option: any,
  level: number,
  event: MouseEvent | KeyboardEvent,
) {
  if (isOptionDisabled(option))
    return
  if (isGroup(option, level))
    return
  chooseOption(option, level, event)
}

function chooseOption(
  option: any,
  level: number,
  event: MouseEvent | KeyboardEvent,
) {
  if (isOptionDisabled(option))
    return
  if (isGroup(option, level)) {
    expandGroup(option, level, event)
    nextTick(() => focusFirstOption(level + 1))
    return
  }
  notifyChange(resolveOptionValue(option, props.optionValue), event)
  close()
  triggerRef.value?.focus()
}

function selectSearchResult(
  item: FlatSearchItem,
  event: MouseEvent | KeyboardEvent,
) {
  if (isOptionDisabled(item.option))
    return
  notifyChange(resolveOptionValue(item.option, props.optionValue), event)
  close()
  triggerRef.value?.focus()
}

function clearValue(event: MouseEvent) {
  notifyChange(null, event)
  close()
  triggerRef.value?.focus()
}

function focusFirstOption(level = 0) {
  const options = levels.value[level]?.options ?? []
  const index = options.findIndex(option => !isOptionDisabled(option))
  focusedOption.value = { level, index }
  nextTick(() => focusFocusedOption())
}

function focusFocusedOption() {
  if (focusedOption.value.index < 0)
    return
  overlayRef.value
    ?.querySelector<HTMLElement>(
      `[data-level="${focusedOption.value.level}"][data-index="${focusedOption.value.index}"]`,
    )
    ?.focus()
}

function moveFocus(delta: number) {
  const { level, index } = focusedOption.value
  const options = levels.value[level]?.options ?? []
  if (!options.length)
    return
  let next = index
  do {
    next = (next + delta + options.length) % options.length
  } while (isOptionDisabled(options[next]) && next !== index)
  focusedOption.value = { level, index: next }
  nextTick(() => focusFocusedOption())
}

function onButtonKeydown(event: KeyboardEvent) {
  if (['Enter', ' ', 'ArrowDown'].includes(event.key)) {
    event.preventDefault()
    if (!visible.value)
      open(event)
  }
  else if (event.key === 'Escape' && visible.value) {
    event.preventDefault()
    close()
  }
}

function onSearchKeydown(event: KeyboardEvent) {
  if (!['ArrowDown', 'ArrowUp', 'Enter', ' ', 'Escape', 'Tab'].includes(event.key))
    return
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    if (focusedSearchIndex.value < 0)
      focusFirstSearchResult()
    else moveSearchFocus(event.key === 'ArrowDown' ? 1 : -1)
    return
  }
  onPanelKeydown(event)
}

function focusFirstSearchResult() {
  const index = searchResults.value.findIndex(
    item => !isOptionDisabled(item.option),
  )
  focusedSearchIndex.value = index
  nextTick(() => focusFocusedSearchResult())
}

function focusFocusedSearchResult() {
  if (focusedSearchIndex.value < 0)
    return
  overlayRef.value
    ?.querySelector<HTMLElement>(
      `[data-search-index="${focusedSearchIndex.value}"]`,
    )
    ?.focus()
}

function moveSearchFocus(delta: number) {
  const results = searchResults.value
  if (!results.length)
    return
  let next
    = focusedSearchIndex.value < 0
      ? delta > 0
        ? 0
        : results.length - 1
      : focusedSearchIndex.value
  const start = next
  do {
    next = (next + delta + results.length) % results.length
  } while (
    isOptionDisabled(results[next].option)
    && next !== start
    && next !== focusedSearchIndex.value
  )
  focusedSearchIndex.value = next
  nextTick(() => focusFocusedSearchResult())
}

function onPanelKeydown(event: KeyboardEvent) {
  if (isSearchActive.value) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      moveSearchFocus(event.key === 'ArrowDown' ? 1 : -1)
    }
    else if (event.key === 'Enter' || event.key === ' ') {
      const item = searchResults.value[focusedSearchIndex.value]
      if (item) {
        event.preventDefault()
        selectSearchResult(item, event)
      }
    }
    else if (event.key === 'Escape' || event.key === 'Tab') {
      close()
      triggerRef.value?.focus()
    }
    return
  }

  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault()
    moveFocus(event.key === 'ArrowDown' ? 1 : -1)
  }
  else if (event.key === 'ArrowRight') {
    const option
      = levels.value[focusedOption.value.level]?.options[
        focusedOption.value.index
      ]
    if (option && isGroup(option, focusedOption.value.level)) {
      activePath.value = [
        ...activePath.value.slice(0, focusedOption.value.level),
        option,
      ]
      nextTick(() => focusFirstOption(focusedOption.value.level + 1))
    }
  }
  else if (event.key === 'ArrowLeft' && focusedOption.value.level > 0) {
    activePath.value = activePath.value.slice(0, -1)
    nextTick(() => focusFirstOption(focusedOption.value.level - 1))
  }
  else if (event.key === 'Enter' || event.key === ' ') {
    const { level, index } = focusedOption.value
    const option = levels.value[level]?.options[index]
    if (option) {
      event.preventDefault()
      chooseOption(option, level, event)
    }
  }
  else if (event.key === 'Escape' || event.key === 'Tab') {
    close()
    triggerRef.value?.focus()
  }
}

function onDocumentPointerDown(event: PointerEvent) {
  if (!visible.value)
    return
  const target = event.target as Node
  if (!rootRef.value?.contains(target) && !overlayRef.value?.contains(target))
    close()
}

function updateOverlayPosition() {
  if (!visible.value || !shouldTeleport.value || !rootRef.value)
    return
  const rect = rootRef.value.getBoundingClientRect()
  const overlay = overlayRef.value
  const width = overlay?.offsetWidth ?? 224
  const height = overlay?.offsetHeight ?? 400
  const top
    = rect.bottom + 4 + height > window.innerHeight && rect.top > height + 4
      ? rect.top - height - 4
      : rect.bottom + 4
  const left = Math.min(
    Math.max(8, rect.left),
    Math.max(8, window.innerWidth - width - 8),
  )
  overlayPosition.value = { top: `${Math.max(8, top)}px`, left: `${left}px` }
}

function containsNode(node: Node | null | undefined) {
  if (!node)
    return false
  return Boolean(
    rootRef.value?.contains(node) || overlayRef.value?.contains(node),
  )
}

/** 焦点是否仍在级联组件内（含 Teleport 面板） */
function isFocusWithinComponent(
  relatedTarget?: Node | null,
  activeElement: Element | null = document.activeElement,
) {
  return containsNode(relatedTarget) || containsNode(activeElement)
}

function onFocus(event: FocusEvent) {
  emit('focus', event)
}

function onBlur(event: FocusEvent) {
  nextTick(() => {
    // 面板打开中或焦点仍在组件内，不触发表单校验
    if (visible.value || isFocusWithinComponent(event.relatedTarget as Node | null))
      return
    fieldProps.value.onBlur?.(event)
  })
  emit('blur', event)
}

/** 阻止焦点移入 Teleport 面板时冒泡到 FormField 触发校验 */
function onRootFocusOut(event: FocusEvent) {
  if (!visible.value)
    return
  if (isFocusWithinComponent(event.relatedTarget as Node | null))
    event.stopPropagation()
}

/** 搜索框及菜单交互失焦时，面板仍打开则不应触发表单校验 */
function onOverlayFocusOut(event: FocusEvent) {
  if (!visible.value)
    return
  const relatedTarget = event.relatedTarget as Node | null
  if (isFocusWithinComponent(relatedTarget))
    event.stopPropagation()
  else if (!relatedTarget)
    event.stopPropagation()
}

function getSearchResultClass(item: FlatSearchItem, index: number) {
  const selected = selectedOption.value === item.option
  const focused = focusedSearchIndex.value === index
  return [
    'm-input-cascade-select-option',
    'm-input-cascade-select-search-option',
    {
      'is-selected': selected,
      'is-focused': focused,
      'is-disabled': isOptionDisabled(item.option),
    },
  ]
}
function getOptionClass(option: any, level: number, index: number) {
  const selected = selectedOption.value === option
  const focused
    = focusedOption.value.level === level && focusedOption.value.index === index
  return [
    'm-input-cascade-select-option',
    {
      'is-selected': selected,
      'is-focused': focused,
      'is-active': activePath.value[level] === option,
      'is-disabled': isOptionDisabled(option),
      'is-group': isGroup(option, level),
    },
    getPt('option', {
      option,
      context: {
        option,
        index,
        level,
        optionGroup: isGroup(option, level),
        leaf: isLeaf(option, level),
        active: activePath.value[level] === option,
        disabled: isOptionDisabled(option),
      },
    }).class,
  ]
}
</script>

<template>
  <div ref="root" v-bind="{ ...rootAttrs, ...getPt('root') }" class="m-input-cascade-select w-full" :class="[
    props.size,
    {
      'is-open': visible,
      'p-invalid': props.invalid,
      'p-disabled': props.disabled,
    },
    attrs.class,
  ]" :style="attrs.style" @focusout="onRootFocusOut"
  >
    <button :id="props.inputId" ref="trigger" type="button" class="m-input-cascade-select-trigger" :class="props.inputClass" :style="props.inputStyle" :disabled="props.disabled"
            :tabindex="props.tabindex ?? 0" :name="props.name" role="combobox" :aria-expanded="visible" :aria-controls="panelId" :aria-label="props.ariaLabel" :aria-labelledby="props.ariaLabelledby"
            :aria-disabled="props.disabled || undefined" v-bind="{ ...props.inputProps, ...getPt('input') }" @click="toggle" @keydown="onButtonKeydown" @focus="onFocus" @blur="onBlur"
    >
      <span class="m-input-cascade-select-value" :class="{ 'tt-inactive opacity-80': !hasValue }">
        <slot name="value" :value="selectedOption" :placeholder="props.placeholder" :path="selectedDisplayPath" :path-segments="selectedPathSegments">
          <span v-if="selectedOption" class="selectitem">
            <!-- 选中态仅展示路径文案，图标只在面板选项/搜索结果中呈现 -->
            <span>{{ selectedDisplayText }}</span>
            <slot name="value-extra" :value="selectedOption" />
          </span>
          <span v-else class=" tt-secondary opacity-54">{{ props.placeholder }}</span>
        </slot>
      </span>
      <span v-if="props.showClear && hasValue" class="m-input-cascade-select-clear" role="button" tabindex="-1" @mousedown.stop @click.stop="clearValue">
        <slot name="clearicon" :clear-callback="clearValue">
          <SvgIcon name="base/rx_ic_delete" :size="16" color="var(--cascadeselect-clear-icon-color, var(--colors-icon-icon-secondary))" />
        </slot>
      </span>
      <span class="m-input-cascade-select-dropdown-icon" :class="{ 'is-open': visible }">
        <slot v-if="props.loading" name="loadingicon"><i class="pi pi-spinner pi-spin" aria-hidden="true" /></slot>
        <slot v-else name="dropdownicon">
          <SvgIcon name="base/rx_ic_chevron_down" :size="16" color="var(--cascadeselect-dropdown-color, var(--colors-icon-icon-secondary))" />
        </slot>
      </span>
    </button>
    <input v-if="props.name" type="hidden" :name="props.name" :value="typeof currentValue === 'object' ? '' : (currentValue ?? '')">

    <Teleport :to="overlayTarget" :disabled="!shouldTeleport">
      <Transition name="m-cascade-fade">
        <div v-if="visible" :id="panelId" ref="overlay" class="m-input-cascade-select-panel" :class="overlayClass" :style="overlayStyle" role="presentation" v-bind="{
          ...(props.panelProps ?? {}),
          ...(props.overlayProps ?? {}),
          ...getPt('overlay'),
        }" @wheel.stop @touchmove.stop @focusout="onOverlayFocusOut"
        >
          <slot name="header" :value="currentValue" :options="resolvedOptions" />
          <div class="m-input-cascade-select-body">
            <div v-if="props.filter" class="m-input-cascade-select-filter" @click.stop @mousedown.stop>
              <!-- FormFieldIsolate：避免搜索框绑定父级字段；勿用 mousedown.prevent，否则输入框无法聚焦 -->
              <FormFieldIsolate>
                <MInputText ref="searchInput" v-model="searchQuery" size="xs" pre-icon="base/rx_ic_magnify" :placeholder="props.searchMessage ?? $t('搜索内容')"
                            :form-control="{ novalidate: true }" @keydown="onSearchKeydown"
                />
              </FormFieldIsolate>
            </div>
            <div v-if="isSearchActive" class="m-input-cascade-select-search-results" role="listbox" @keydown="onPanelKeydown">
              <div v-if="!searchResults.length" class="m-input-cascade-select-empty">
                {{ props.emptySearchMessage ?? $t("暂无查询结果") }}
              </div>
              <button v-for="(item, index) in searchResults" :key="props.dataKey
                        ? item.option?.[props.dataKey]
                        : `search-${index}`" type="button" :data-search-index="index" :class="getSearchResultClass(item, index)" :disabled="isOptionDisabled(item.option)" role="option" tabindex="-1"
                      @mousedown.prevent @mouseenter="focusedSearchIndex = index" @click="selectSearchResult(item, $event)"
              >
                <span class="m-input-cascade-select-option-content">
                  <slot name="option" :option="item.option" :selected="selectedOption === item.option" :level="item.level" :option-group="false" :leaf="true" :disabled="isOptionDisabled(item.option)" :path="item.path">
                    <span class="selectitem selectitem--path">
                      <template v-for="(segment, segIndex) in item.pathSegments" :key="props.dataKey ? segment.option?.[props.dataKey] ?? segIndex : segIndex">
                        <span v-if="segIndex > 0" class="selectitem__separator" aria-hidden="true">{{ props.pathSeparator ?? '/' }}</span>
                        <span class="selectitem__segment">
                          <img v-if="segment.visual.image" class="selectitem__image" :src="props.darkMode ? segment.visual.darkImage : segment.visual.image">
                          <SvgIcon v-else-if="segment.visual.icon" :name="segment.visual.icon" :color="props.iconColor" fallback="base/rx_ic_earth" />
                          <span class="selectitem__label">
                            <template v-for="(part, partIndex) in getHighlightedLabelParts(segment.label, searchQuery)" :key="partIndex">
                              <mark v-if="part.matched" class="selectitem__match">{{ part.text }}</mark>
                              <template v-else>{{ part.text }}</template>
                            </template>
                          </span>
                        </span>
                      </template>
                      <slot name="option-extra" :option="item.option" />
                    </span>
                  </slot>
                </span>
              </button>
            </div>
            <div v-else class="m-input-cascade-select-columns" role="menu" @keydown="onPanelKeydown">
              <div v-for="level in levels" :key="level.level" class="m-input-cascade-select-column" :class="getPt('optionList', { level: level.level })" @wheel.stop @touchmove.stop>
                <div v-if="!level.options.length" class="m-input-cascade-select-empty">
                  {{ props.emptyMessage ?? "No available options" }}
                </div>
                <button v-for="(option, index) in level.options" :key="props.dataKey
                          ? option?.[props.dataKey]
                          : `${level.level}-${index}`
                        " type="button" :data-level="level.level" :data-index="index" :class="getOptionClass(option, level.level, index)" :disabled="isOptionDisabled(option)" role="menuitem"
                        :aria-haspopup="isGroup(option, level.level) || undefined" :aria-expanded="isGroup(option, level.level)
                          ? activePath[level.level] === option
                          : undefined
                        " tabindex="-1" @mousedown.prevent @mouseenter="onOptionMouseEnter(option, level.level, index)" @click="onOptionClick(option, level.level, $event)"
                >
                  <span class="m-input-cascade-select-option-content">
                    <slot name="option" :option="option" :selected="selectedOption === option" :level="level.level" :option-group="isGroup(option, level.level)" :leaf="isLeaf(option, level.level)"
                          :disabled="isOptionDisabled(option)"
                    >
                      <span class="selectitem">
                        <SvgIcon v-if="option.icon || props.icon" :name="option.icon || props.icon" :color="props.iconColor" fallback="base/rx_ic_earth" />
                        <img v-if="option.image" class="selectitem__image" :src="props.darkMode ? option.darkImage : option.image">
                        <span>{{
                          getOptionText(option, isGroup(option, level.level))
                        }}</span>
                        <slot name="option-extra" :option="option" />
                      </span>
                    </slot>
                  </span>
                  <span v-if="isGroup(option, level.level)" class="m-input-cascade-select-group-icon">
                    <slot name="optiongroupicon">
                      <SvgIcon name="base/rx_ic_chevron_down" size="var(--cascadeselect-option-icon-size, 0.875rem)" color="var(--cascadeselect-option-icon-color, var(--colors-icon-icon-secondary))" />
                    </slot>
                  </span>
                </button>
              </div>
            </div>
          </div>
          <slot name="footer" :value="currentValue" :options="resolvedOptions" />
        </div>
      </Transition>
    </Teleport>
    <template v-for="slotName in forwardedSlots" :key="slotName">
      <slot :name="slotName" />
    </template>
  </div>
</template>

<style lang="scss" scoped>
.m-input-cascade-select {
  position: relative;
  min-width: 0;
  color: var(--cascadeselect-color, var(--colors-text-text-primary, #171c1f));
  font-family: Inter, sans-serif;

  &.p-disabled {
    color: var(--cascadeselect-disabled-color, var(--colors-text-text-inactive));

    .m-input-cascade-select-trigger {
      background: var(--cascadeselect-disabled-background, var(--colors-background-bg-action-inactive));
    }
  }

  &.p-invalid .m-input-cascade-select-trigger {
    border-color: var(--cascadeselect-invalid-border-color, var(--colors-border-border-error, #ef4444));
  }
}

.m-input-cascade-select-trigger {
  display: flex;
  align-items: center;
  padding: 0;
  width: 100%;
  min-width: 0;
  border: 1px solid var(--cascadeselect-border-color, var(--colors-border-border-action, #c7cdd1));
  background: var(--cascadeselect-background, var(--colors-background-bg-action, #fff));
  box-shadow: var(--cascadeselect-shadow, 0 1px 2px rgb(16 24 40 / 5%));
  color: inherit;
  cursor: pointer;
  border-radius: inherit;
  text-align: left;
  transition:
    background var(--cascadeselect-transition-duration, 0.2s),
    border-color var(--cascadeselect-transition-duration, 0.2s),
    color var(--cascadeselect-transition-duration, 0.2s),
    box-shadow var(--cascadeselect-transition-duration, 0.2s);

  &:not(:disabled):hover {
    border-color: var(--cascadeselect-hover-border-color, var(--colors-border-border-action-hover));
  }

  &:focus-visible {
    border-color: var(--cascadeselect-focus-border-color, var(--colors-border-border-brand));
    outline: var(--cascadeselect-focus-ring-width, 0) var(--cascadeselect-focus-ring-style, none)
      var(--cascadeselect-focus-ring-color, transparent);
    outline-offset: var(--cascadeselect-focus-ring-offset, 0);
    box-shadow: var(--cascadeselect-focus-ring-shadow, none);
  }

  &:disabled {
    cursor: not-allowed;
  }
}

.m-input-cascade-select-value {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  color: var(--cascadeselect-placeholder-color, var(--colors-text-text-primary));
}

.m-input-cascade-select-clear,
.m-input-cascade-select-dropdown-icon {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  justify-content: center;
  color: var(--cascadeselect-dropdown-color, var(--colors-icon-icon-secondary));
}

.m-input-cascade-select-clear {
  margin-inline: 4px;
  color: var(--cascadeselect-clear-icon-color, var(--colors-icon-icon-secondary));
  cursor: pointer;
}

.m-input-cascade-select-dropdown-icon {
  width: var(--cascadeselect-dropdown-width, 2.5rem);
  transition: transform 160ms ease;

  &.is-open {
    transform: rotate(180deg);
  }
}

.selectitem {
  display: flex;
  min-width: 0;
  flex: 1;
  align-items: center;
  gap: 6px;

  > span:not(.selectitem__image) {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__image {
    width: 16px;
    height: 16px;
    flex: 0 0 16px;
    object-fit: contain;
  }

  &--path {
    gap: 4px;
  }

  &__segment {
    display: inline-flex;
    min-width: 0;
    max-width: 100%;
    align-items: center;
    gap: 4px;
  }

  &__separator {
    flex: 0 0 auto;
    color: var(--colors-text-text-tertiary, #697077);
  }

  &__label {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &__match {
    padding: 0;
    background: transparent;
    color: var(--colors-text-text-brand, #1677ff);
    font: inherit;
  }
}

.lg {
  border-radius: 8px;

  .m-input-cascade-select-trigger {
    min-height: 42px;
    font-size: 14px;
    line-height: 20px;
  }

  .m-input-cascade-select-value {
    padding: 10px 10px 10px 12px;
  }

  .selectitem {
    gap: 8px;
  }
}

.md {
  border-radius: 6px;

  .m-input-cascade-select-trigger {
    min-height: 38px;
    font-size: 13px;
    line-height: 20px;
  }

  .m-input-cascade-select-value {
    padding: 8px 8px 8px 10px;
  }
}

.sm {
  border-radius: 6px;

  .m-input-cascade-select-trigger {
    min-height: 32px;
    font-size: 12px;
    line-height: 20px;
  }

  .m-input-cascade-select-value {
    padding: 6px 6px 6px 8px;
  }
}

.xs {
  border-radius: 4px;

  .m-input-cascade-select-trigger {
    min-height: 29px;
    border-width: 0.5px;
    font-size: 12px;
    line-height: 16px;
  }

  .m-input-cascade-select-value {
    padding: 6px;
  }
}

.xxs {
  border-radius: 4px;

  .m-input-cascade-select-trigger {
    min-height: 25px;
    border-width: 0.5px;
    font-size: 12px;
    line-height: 16px;
  }

  .m-input-cascade-select-value {
    padding: 4px 4px 4px 6px;
  }
}
</style>

<style lang="scss">
.m-input-cascade-select-panel {
  --cascade-panel-width: 14rem;
  z-index: 1100;
  position: absolute;
  inset-block-start: calc(100% + 4px);
  inset-inline-start: 0;
  display: block;
  width: max-content;
  max-width: calc(100vw - 1rem);
  overflow: hidden;
  border: 1px solid var(--cascadeselect-overlay-border-color, var(--colors-border-border-subtle, #c7cdd1));
  border-radius: var(--cascadeselect-overlay-border-radius, var(--radius-md, 6px));
  background: var(--cascadeselect-overlay-background, var(--colors-background-bg-overlay, #fff));
  box-shadow: var(--cascadeselect-overlay-shadow, 0 4px 6px -1px rgb(0 0 0 / 10%), 0 2px 4px -2px rgb(0 0 0 / 10%));
  color: var(--cascadeselect-overlay-color, var(--colors-text-text-primary, #171c1f));
  font-family: Inter, sans-serif;
  font-size: 13px;
  line-height: var(--Line-Height-text-xs, 16px);

  .m-input-cascade-select-body {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-sm, 4px);
  }

  .m-input-cascade-select-filter {
    box-sizing: border-box;
    width: var(--cascade-panel-width);
    min-width: var(--cascade-panel-width);
    max-width: var(--cascade-panel-width);
    padding: var(--cascadeselect-list-padding, 0.25rem);
    padding-bottom: 0;
  }

  .m-input-cascade-select-search-results {
    width: max-content;
    min-width: var(--cascade-panel-width);
    max-width: min(32rem, calc(100vw - 1rem));
    max-height: 400px;
    display: flex;
    flex-direction: column;
    gap: var(--cascadeselect-list-gap, 2px);
    padding: var(--cascadeselect-list-padding, 0.25rem);
    overflow-x: hidden;
    overflow-y: auto;
    overscroll-behavior: contain;
    scrollbar-gutter: stable;
  }

  .m-input-cascade-select-search-option {
    .selectitem--path {
      flex-wrap: wrap;
    }

    .selectitem__label {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  .m-input-cascade-select-columns {
    display: flex;
    max-width: calc(100vw - 1rem);
    overflow-x: auto;
    overscroll-behavior: contain;
  }

  .m-input-cascade-select-column {
    width: var(--cascade-panel-width);
    min-width: var(--cascade-panel-width);
    max-height: 400px;
    display: flex;
    flex-direction: column;
    gap: var(--cascadeselect-list-gap, 2px);
    padding: var(--cascadeselect-list-padding, 0.25rem);
    overflow-x: hidden;
    overflow-y: auto;
    overscroll-behavior: contain;
    scrollbar-gutter: stable;
  }

  .m-input-cascade-select-column + .m-input-cascade-select-column {
    border-inline-start: 1px solid
      var(--cascadeselect-overlay-border-color, var(--colors-border-border-subtle, #e5e7eb));
  }

  .m-input-cascade-select-option {
    display: flex;
    align-items: center;
    width: 100%;
    padding: var(--cascadeselect-option-padding, 0.5rem 0.75rem);
    border: 0;
    border-radius: var(--cascadeselect-option-border-radius, var(--radius-sm, 4px));
    background: transparent;
    color: var(--cascadeselect-option-color, var(--colors-text-text-primary, #171c1f));
    cursor: pointer;
    font-family: Inter, sans-serif;
    font-size: 13px;
    font-weight: 400;
    line-height: var(--Line-Height-text-xs, 16px);
    text-align: left;
    transition:
      background var(--cascadeselect-transition-duration, 0.2s),
      color var(--cascadeselect-transition-duration, 0.2s);

    &:hover,
    &.is-focused,
    &.is-active {
      background: var(--cascadeselect-option-focus-background, var(--colors-background-bg-action-hover, #f3f4f6));
      color: var(--cascadeselect-option-focus-color, var(--colors-text-text-primary-hover, #171c1f));
    }

    &.is-selected {
      background: var(--cascadeselect-option-selected-background, var(--colors-background-bg-action-hover, #f3f4f6));
      color: var(--cascadeselect-option-selected-color, var(--colors-text-text-primary, #171c1f));
    }

    &.is-selected.is-focused {
      background: var(
        --cascadeselect-option-selected-focus-background,
        var(--colors-background-bg-action-hover, #f3f4f6)
      );
      color: var(--cascadeselect-option-selected-focus-color, var(--colors-text-text-primary-hover, #171c1f));
    }

    &.is-disabled {
      cursor: not-allowed;
      opacity: 0.5;
    }
  }

  .m-input-cascade-select-option-content {
    display: flex;
    min-width: 0;
    flex: 1;
  }

  .m-input-cascade-select-group-icon {
    display: inline-flex;
    margin-inline-start: 8px;
    color: var(--cascadeselect-option-icon-color, var(--colors-icon-icon-secondary));
    transform: rotate(-90deg);
  }

  .m-input-cascade-select-option:hover .m-input-cascade-select-group-icon,
  .m-input-cascade-select-option.is-focused .m-input-cascade-select-group-icon,
  .m-input-cascade-select-option.is-active .m-input-cascade-select-group-icon {
    color: var(--cascadeselect-option-icon-focus-color, var(--colors-icon-icon-secondary-hover));
  }

  .m-input-cascade-select-empty {
    padding: var(--cascadeselect-option-padding, 0.5rem 0.75rem);
    color: var(--cascadeselect-overlay-color, var(--colors-text-text-secondary, #6b7280));
    font-size: 13px;
  }
}

.m-cascade-fade-enter-active,
.m-cascade-fade-leave-active {
  transition:
    opacity 120ms ease,
    transform 120ms ease;
}

.m-cascade-fade-enter-from,
.m-cascade-fade-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
