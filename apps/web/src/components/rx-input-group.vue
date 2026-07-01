<script lang="ts" setup>
import InputText from 'primevue/inputtext'

export interface NumberGroupField {
  disabled?: boolean
  type?: 'number' | 'text'
  /** 只读展示值，不参与 v-model */
  value?: number | null
  placeholder?: string
  min?: number
  max?: number
  validate?: (value: number | string | null) => string | undefined | Promise<string | undefined>
}

export interface NumberGroupSeparator {
  separator: true
  text?: string
}

export type NumberGroupItem = NumberGroupField | NumberGroupSeparator

interface ParsedSeparator {
  kind: 'separator'
  itemIndex: number
  text: string
}

interface ParsedReadonly {
  kind: 'readonly'
  itemIndex: number
  type: FieldInputType
  placeholder?: string
  inputValue: string
}

type FieldInputType = NonNullable<NumberGroupField['type']>

defineOptions({ inheritAttrs: false })

const props = withDefaults(defineProps<{
  items?: NumberGroupItem[]
}>(), {
  items: () => [],
})

const emit = defineEmits<{
  blur: [payload: { index: number, modelIndex: number, value: number | string | null }]
}>()

function resolveFieldType(field: NumberGroupField): FieldInputType {
  if (field.type)
    return field.type
  if (field.min !== undefined || field.max !== undefined)
    return 'number'
  return 'text'
}

interface ParsedEditable {
  kind: 'editable'
  itemIndex: number
  modelIndex: number
  type: FieldInputType
  placeholder?: string
  min?: number
  max?: number
  validate?: NumberGroupField['validate']
}

type ParsedItem = ParsedSeparator | ParsedReadonly | ParsedEditable

interface RenderSeparator {
  kind: 'separator'
  itemIndex: number
  text: string
}

interface RenderReadonly {
  kind: 'readonly'
  itemIndex: number
  type: FieldInputType
  inputValue: string
  placeholder?: string
  disabled: true
}

interface RenderEditable {
  kind: 'editable'
  itemIndex: number
  modelIndex: number
  type: FieldInputType
  inputValue: string
  error?: string
  placeholder?: string
  min?: number
  max?: number
}

type RenderField = RenderSeparator | RenderReadonly | RenderEditable

const model = defineModel<(number | string | null)[]>({ default: () => [] })

const errors = ref<(string | undefined)[]>([])

const parsedItems = computed((): ParsedItem[] => {
  let modelIndex = -1
  return props.items.map((item, itemIndex): ParsedItem => {
    if ('separator' in item && item.separator)
      return { kind: 'separator', itemIndex, text: item.text ?? ':' }

    const field = item as NumberGroupField
    if (field.disabled) {
      return {
        kind: 'readonly',
        itemIndex,
        type: field.type ?? 'text',
        placeholder: field.placeholder,
        inputValue: String(field.value ?? ''),
      }
    }

    modelIndex++
    return {
      kind: 'editable',
      itemIndex,
      modelIndex,
      type: resolveFieldType(field),
      placeholder: field.placeholder,
      min: field.min,
      max: field.max,
      validate: field.validate,
    }
  })
})

const editableCount = computed(() =>
  parsedItems.value.filter(p => p.kind === 'editable').length,
)

const renderFields = computed((): RenderField[] => {
  const values = model.value ?? []
  const errs = errors.value

  return parsedItems.value.map((p): RenderField => {
    if (p.kind === 'separator')
      return p

    if (p.kind === 'readonly')
      return { ...p, disabled: true as const }

    return {
      kind: 'editable',
      itemIndex: p.itemIndex,
      modelIndex: p.modelIndex,
      type: p.type,
      inputValue: String(values[p.modelIndex] ?? ''),
      error: errs[p.modelIndex],
      placeholder: p.placeholder,
      min: p.min,
      max: p.max,
    }
  })
})

function resizeArray<T>(arr: T[], length: number, fill: T): T[] {
  if (arr.length === length)
    return arr
  if (arr.length < length)
    return [...arr, ...Array.from({ length: length - arr.length }).fill(fill) as T[]]
  return arr.slice(0, length)
}

function syncState() {
  const count = editableCount.value
  const nextModel = resizeArray(model.value ?? [], count, null)
  const nextErrors = resizeArray(errors.value, count, undefined)
  if (nextModel !== model.value)
    model.value = nextModel
  if (nextErrors !== errors.value)
    errors.value = nextErrors
}

watch(editableCount, syncState, { immediate: true })

/** validation pipeline: resolveError → validateAt → validate */
async function resolveError(
  field: Pick<ParsedEditable, 'type' | 'min' | 'max' | 'validate'>,
  value: number | string | null,
): Promise<string | undefined> {
  if (field.type === 'number' && value !== null && typeof value === 'number') {
    const { min, max } = field
    if (min !== undefined && value < min)
      return max !== undefined ? `范围 ${min}~${max}` : `不能小于 ${min}`
    if (max !== undefined && value > max)
      return min !== undefined ? `范围 ${min}~${max}` : `不能大于 ${max}`
  }

  if (field.validate)
    return (await field.validate(value)) ?? undefined

  return undefined
}

async function validateAt(field: ParsedEditable): Promise<boolean> {
  const value = model.value?.[field.modelIndex] ?? null
  errors.value[field.modelIndex] = await resolveError(field, value)
  return !errors.value[field.modelIndex]
}

async function validate(): Promise<boolean> {
  const results = await Promise.all(
    parsedItems.value
      .filter((p): p is ParsedEditable => p.kind === 'editable')
      .map(p => validateAt(p)),
  )
  return results.every(Boolean)
}

function onInput(field: RenderEditable, value: string | undefined) {
  const raw = value ?? ''
  const next = [...(model.value ?? [])]

  if (field.type === 'number') {
    const parsed = raw === '' ? null : Number(raw)
    next[field.modelIndex] = parsed === null || Number.isNaN(parsed) ? null : parsed
  }
  else {
    next[field.modelIndex] = raw === '' ? null : raw
  }

  model.value = next
  errors.value[field.modelIndex] = undefined
}

async function onBlur(field: RenderEditable) {
  const parsed = parsedItems.value[field.itemIndex]
  if (parsed.kind !== 'editable')
    return

  const value = model.value?.[field.modelIndex] ?? null
  await validateAt(parsed)
  emit('blur', { index: field.itemIndex, modelIndex: field.modelIndex, value })
}

defineExpose({ validate })
</script>

<template>
  <div class="number-group" v-bind="$attrs">
    <template v-for="field in renderFields" :key="field.itemIndex">
      <div v-if="field.kind === 'separator'" class="number-group-separator">
        {{ field.text }}
      </div>
      <div v-else class="number-group-item">
        <InputText
          class="number-group-item-input w-full"
          :type="field.type"
          :model-value="field.inputValue"
          :disabled="field.kind === 'readonly'"
          :placeholder="field.placeholder"
          :min="field.kind === 'editable' ? field.min : undefined"
          :max="field.kind === 'editable' ? field.max : undefined"
          @update:model-value="field.kind === 'editable' && onInput(field, $event)"
          @blur="field.kind === 'editable' && onBlur(field)"
        />
        <div v-if="field.kind === 'editable' && field.error" class="number-group-item-error">
          {{ field.error }}
        </div>
      </div>
    </template>
  </div>
</template>

<style lang="scss" scoped>
.number-group {
  display: flex;
  flex: 1;
  align-items: center;
  padding: 8px 8px 8px 10px;
  gap: 6px;
  min-height: 38px;
  border-radius: 6px;
  border: 1px solid var(--colors-border-border-action);
  background: var(--colors-background-bg-action);
  box-shadow: 0px 1px 2px 0px rgba(16, 24, 40, 0.05);
  color: var(--colors-text-text-primary);
  font-size: 13px;
  line-height: 20px;

  &-separator {
    color: inherit;
    font: inherit;
    letter-spacing: inherit;
  }

  &-item {
    position: relative;
    flex: 1;
    color: inherit;
    font: inherit;
    letter-spacing: inherit;

    :deep(.number-group-item-input) {
      font: inherit;
      letter-spacing: inherit;
      color: inherit;
      width: 100%;
      padding: 0;
      border: none;
      box-shadow: none;
      background-color: transparent;

      &:disabled {
        color: var(--colors-text-text-inactive);
      }

      &::placeholder {
        color: inherit;
        opacity: 0.5;
      }
    }

    &-error {
      position: absolute;
      left: -8px;
      top: 160%;
      color: var(--colors-text-text-error);
      font-size: 12px;
      z-index: 1;
    }
  }
}
</style>
