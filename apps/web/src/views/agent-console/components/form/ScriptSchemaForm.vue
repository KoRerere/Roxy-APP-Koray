<script setup lang="ts">
import type {
  ControlElement,
  JsonFormsI18nState,
  JsonFormsRendererRegistryEntry,
  JsonSchema,
} from '@jsonforms/core'
import type { JsonFormsChangeEvent } from '@jsonforms/vue'
import type { ErrorObject } from 'ajv'
import { isEnumControl, isNumberControl, rankWith, resolveSchema } from '@jsonforms/core'
import { JsonForms, rendererProps, useJsonFormsControl, useJsonFormsEnumControl } from '@jsonforms/vue'
import { ControlWrapper, defaultStyles, mergeStyles, useVanillaControl, vanillaRenderers } from '@jsonforms/vue-vanilla'
import {
  createScriptParamsAjv,
  createScriptParamsFormSchema,
  createScriptParamsFormUISchema,
  localizeScriptParamsSchema,
} from '../../script-template-params'
import AgentSelect from './AgentSelect.vue'
import { $t } from '/@/locales'

const props = withDefaults(defineProps<{
  schema: JsonSchema
  data: Record<string, unknown>
  locale?: string
  readonly?: boolean
  showValidationErrors?: boolean
}>(), {
  locale: 'en',
  readonly: false,
  showValidationErrors: false,
})

const emit = defineEmits<{
  change: [event: JsonFormsChangeEvent]
  schemaError: [message: string]
}>()

const scriptSchemaEnumControlRenderer = defineComponent({
  name: 'ScriptSchemaEnumControlRenderer',
  props: rendererProps<ControlElement>(),
  setup(rendererProps) {
    const binding = useVanillaControl(useJsonFormsEnumControl(rendererProps))

    return () => {
      const control = binding.control.value

      return h(
        ControlWrapper,
        {
          ...binding.controlWrapper.value,
          styles: binding.styles,
          isFocused: binding.isFocused.value,
          appliedOptions: binding.appliedOptions.value,
        },
        {
          default: () => h(AgentSelect, {
            id: `${control.id}-input`,
            modelValue: control.data,
            options: control.options,
            optionLabel: 'label',
            optionValue: 'value',
            disabled: !control.enabled,
            autofocus: Boolean(binding.appliedOptions.value.focus),
            ...{
              'onUpdate:modelValue': (value: unknown) => {
                binding.handleChange(control.path, value ?? undefined)
              },
            },
            onFocus: () => { binding.isFocused.value = true },
            onBlur: () => { binding.isFocused.value = false },
          }),
        },
      )
    }
  },
})

const scriptSchemaEnumControlRendererEntry: JsonFormsRendererRegistryEntry = {
  renderer: scriptSchemaEnumControlRenderer,
  tester: rankWith(3, isEnumControl),
}

const scriptSchemaNumberControlRenderer = defineComponent({
  name: 'ScriptSchemaNumberControlRenderer',
  props: rendererProps<ControlElement>(),
  setup(rendererProps) {
    const binding = useVanillaControl(useJsonFormsControl(rendererProps), (target: HTMLInputElement) => {
      return target.value === '' ? undefined : Number(target.value)
    })

    return () => {
      const control = binding.control.value

      return h(
        ControlWrapper,
        {
          ...binding.controlWrapper.value,
          styles: binding.styles,
          isFocused: binding.isFocused.value,
          appliedOptions: binding.appliedOptions.value,
        },
        {
          default: () => h('input', {
            id: `${control.id}-input`,
            type: 'number',
            step: 'any',
            class: binding.styles.control.input,
            value: control.data,
            disabled: !control.enabled,
            autofocus: Boolean(binding.appliedOptions.value.focus),
            placeholder: binding.appliedOptions.value.placeholder,
            onChange: binding.onChange,
            onFocus: () => { binding.isFocused.value = true },
            onBlur: () => { binding.isFocused.value = false },
          }),
        },
      )
    }
  },
})

const scriptSchemaNumberControlRendererEntry: JsonFormsRendererRegistryEntry = {
  renderer: scriptSchemaNumberControlRenderer,
  tester: rankWith(3, isNumberControl),
}

function withPersistentDescription(
  entry: JsonFormsRendererRegistryEntry,
): JsonFormsRendererRegistryEntry {
  const rendererName = entry.renderer.name as string | undefined
  if (!rendererName?.endsWith('ControlRenderer'))
    return entry

  const renderer = entry.renderer
  return {
    ...entry,
    renderer: defineComponent({
      name: `${rendererName}WithPersistentDescription`,
      props: rendererProps<ControlElement>(),
      setup(props) {
        return () => {
          const controlSchema = resolveSchema(props.schema, props.uischema.scope, props.schema)
          const description = typeof controlSchema.description === 'string' ? controlSchema.description : ''
          return h('div', { class: 'script-jsonforms__control-shell' }, [
            h(renderer, { ...props }),
            description
              ? h('div', { class: 'script-jsonforms__description' }, description)
              : null,
          ])
        }
      },
    }),
  }
}

const renderers = Object.freeze([
  scriptSchemaEnumControlRendererEntry,
  scriptSchemaNumberControlRendererEntry,
  ...vanillaRenderers,
].map(withPersistentDescription))
const config = Object.freeze({ showUnfocusedDescription: true })
const styles = mergeStyles(defaultStyles, {
  control: {
    root: 'script-jsonforms__control',
    wrapper: 'script-jsonforms__wrapper',
    label: 'script-jsonforms__label',
    description: 'script-jsonforms__description',
    error: 'script-jsonforms__error',
    input: 'script-jsonforms__input',
    textarea: 'script-jsonforms__textarea',
    select: 'script-jsonforms__select',
    option: 'script-jsonforms__option',
    asterisk: 'script-jsonforms__asterisk',
  },
  verticalLayout: {
    root: 'script-jsonforms__vertical-layout',
    item: 'script-jsonforms__layout-item',
  },
  horizontalLayout: {
    root: 'script-jsonforms__horizontal-layout',
    item: 'script-jsonforms__layout-item',
  },
  group: {
    root: 'script-jsonforms__group',
    label: 'script-jsonforms__group-label',
    item: 'script-jsonforms__group-item',
  },
  arrayList: {
    root: 'script-jsonforms__array',
    legend: 'script-jsonforms__array-legend',
    addButton: 'script-jsonforms__array-add',
    label: 'script-jsonforms__array-label',
    itemWrapper: 'script-jsonforms__array-item-wrapper',
    noData: 'script-jsonforms__array-empty',
    item: 'script-jsonforms__array-item',
    itemToolbar: 'script-jsonforms__array-toolbar',
    itemLabel: 'script-jsonforms__array-item-label',
    itemContent: 'script-jsonforms__array-content',
    itemExpanded: 'script-jsonforms__array-content--expanded',
    itemMoveUp: 'script-jsonforms__array-action script-jsonforms__array-action--up',
    itemMoveDown: 'script-jsonforms__array-action script-jsonforms__array-action--down',
    itemDelete: 'script-jsonforms__array-action script-jsonforms__array-action--delete',
  },
  oneOf: { root: 'script-jsonforms__one-of' },
  dialog: {
    root: 'script-jsonforms__dialog',
    title: 'script-jsonforms__dialog-title',
    body: 'script-jsonforms__dialog-body',
    actions: 'script-jsonforms__dialog-actions',
    buttonPrimary: 'script-jsonforms__dialog-button script-jsonforms__dialog-button--primary',
    buttonSecondary: 'script-jsonforms__dialog-button',
  },
})

provide('styles', styles)

const formRoot = useTemplateRef<HTMLDivElement>('formRoot')
const localizedSchema = computed(() => localizeScriptParamsSchema(props.schema, props.locale))
const formSchema = computed(() => createScriptParamsFormSchema(localizedSchema.value))
const formUISchema = computed(() => createScriptParamsFormUISchema(localizedSchema.value))
let descriptionResizeObserver: ResizeObserver | undefined
let descriptionMutationObserver: MutationObserver | undefined

function syncDescriptionTooltips() {
  const descriptionElements = formRoot.value?.querySelectorAll<HTMLElement>('.script-jsonforms__description')
  descriptionElements?.forEach((element) => {
    const description = element.textContent?.trim() ?? ''
    const isOverflowing = element.scrollWidth > element.clientWidth + 1

    if (description && isOverflowing)
      element.title = description
    else
      element.removeAttribute('title')
  })
}

function scheduleDescriptionTooltipSync() {
  void nextTick(syncDescriptionTooltips)
}

function markControlTouched(event: FocusEvent) {
  const target = event.target
  if (!(target instanceof HTMLElement))
    return

  const control = target.closest<HTMLElement>('.script-jsonforms__control')
  if (!control || !formRoot.value?.contains(control))
    return

  const nextTarget = event.relatedTarget
  if (nextTarget instanceof Node && control.contains(nextTarget))
    return

  control.classList.add('script-jsonforms__control--touched')
}

function validateControlOnInput(event: Event) {
  const target = event.target
  if (!(target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) {
    return
  }
  if (event instanceof InputEvent && event.isComposing) {
    return
  }

  const control = target.closest<HTMLElement>('.script-jsonforms__control')
  if (!control || !formRoot.value?.contains(control)) {
    return
  }

  control.classList.add('script-jsonforms__control--touched')
  if (target instanceof HTMLInputElement && target.type === 'number') {
    return
  }
  if (target instanceof HTMLInputElement && target.validity.badInput) {
    return
  }
  if (target.type !== 'checkbox' && target.type !== 'radio') {
    target.dispatchEvent(new Event('change', { bubbles: true }))
  }
}

function preventNumberInputWheel(event: WheelEvent) {
  const target = event.target
  if (
    target instanceof HTMLInputElement
    && target.type === 'number'
    && document.activeElement === target
  ) {
    event.preventDefault()
  }
}

function clearTouchedControls() {
  formRoot.value
    ?.querySelectorAll('.script-jsonforms__control--touched')
    .forEach(element => element.classList.remove('script-jsonforms__control--touched'))
}

onMounted(() => {
  const root = formRoot.value
  if (!root)
    return

  descriptionResizeObserver = new ResizeObserver(scheduleDescriptionTooltipSync)
  descriptionResizeObserver.observe(root)
  descriptionMutationObserver = new MutationObserver(scheduleDescriptionTooltipSync)
  descriptionMutationObserver.observe(root, { childList: true, characterData: true, subtree: true })
  scheduleDescriptionTooltipSync()
})

onBeforeUnmount(() => {
  descriptionResizeObserver?.disconnect()
  descriptionMutationObserver?.disconnect()
})

watch(localizedSchema, scheduleDescriptionTooltipSync, { flush: 'post' })
watch(() => props.schema, () => void nextTick(clearTouchedControls))

const validator = computed(() => {
  const ajv = createScriptParamsAjv(formSchema.value)
  try {
    ajv.compile(formSchema.value)
    return { ajv, error: '' }
  }
  catch (error) {
    return { ajv, error: error instanceof Error ? error.message : '脚本入参 Schema 无效' }
  }
})

watch(() => validator.value.error, error => emit('schemaError', error), { immediate: true })

const translations = computed<Record<string, string>>(() => ({
  addTooltip: $t('添加'),
  addAriaLabel: $t('添加参数项'),
  removeTooltip: $t('删除'),
  removeAriaLabel: $t('删除参数项'),
  upAriaLabel: $t('上移参数项'),
  downAriaLabel: $t('下移参数项'),
  noDataMessage: $t('暂无数据'),
  clearDialogTitle: $t('切换参数类型'),
  clearDialogMessage: $t('切换类型会清空当前参数，是否继续？'),
  clearDialogAccept: $t('继续'),
  clearDialogDecline: $t('取消'),
}))

const validationMessages = computed<Record<string, string>>(() => ({
  required: $t('此项为必填项'),
  type: $t('参数类型不正确'),
  format: $t('参数格式不正确'),
  enum: $t('请选择有效选项'),
  const: $t('参数值不正确'),
  minimum: $t('参数值低于允许范围'),
  maximum: $t('参数值超出允许范围'),
  minLength: $t('输入内容过短'),
  maxLength: $t('输入内容过长'),
  minItems: $t('列表项数量不足'),
  maxItems: $t('列表项数量过多'),
  pattern: $t('输入内容格式不正确'),
  additionalProperties: $t('包含不支持的参数'),
}))

const i18n = computed<JsonFormsI18nState>(() => ({
  locale: props.locale,
  translate: (id, defaultMessage) => {
    const key = id.split('.').at(-1) || id
    return translations.value[key] || defaultMessage
  },
  translateError: error => validationMessages.value[error.keyword] || error.message || $t('参数校验失败'),
}))

function onChange(event: JsonFormsChangeEvent) {
  emit('change', {
    data: event.data,
    errors: (event.errors ?? []) as ErrorObject[],
  })
}
</script>

<template>
  <div
    ref="formRoot"
    class="script-jsonforms"
    :class="{ 'script-jsonforms--show-errors': showValidationErrors }"
    @input="validateControlOnInput"
    @focusout="markControlTouched"
    @wheel="preventNumberInputWheel"
  >
    <JsonForms
      v-if="!validator.error"
      :data="data"
      :schema="formSchema"
      :uischema="formUISchema"
      :renderers="renderers"
      :config="config"
      :readonly="readonly"
      :ajv="validator.ajv"
      :i18n="i18n"
      validation-mode="ValidateAndShow"
      @change="onChange"
    />
    <p v-else class="script-jsonforms__schema-error" role="alert">
      {{ $t('脚本入参 Schema 无效') }}：{{ validator.error }}
    </p>
  </div>
</template>

<style scoped lang="scss">
.script-jsonforms {
  min-width: 0;
  color: #141414;
  font-size: 13px;

  :deep(.script-jsonforms__vertical-layout) {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 12px;
  }

  :deep(.script-jsonforms__horizontal-layout) {
    display: grid;
    min-width: 0;
    gap: 12px;
    grid-template-columns: repeat(auto-fit, minmax(min(180px, 100%), 1fr));
  }

  :deep(.script-jsonforms__control-shell),
  :deep(.script-jsonforms__control) {
    display: grid;
    min-width: 0;
    grid-template-areas:
      'label description'
      'control control'
      'error error';
    grid-template-columns: fit-content(50%) minmax(0, 1fr);
    column-gap: 6px;
    row-gap: 6px;
  }

  :deep(.script-jsonforms__control-shell:not(:has(> .script-jsonforms__control))) {
    display: none;
  }

  :deep(.script-jsonforms__control-shell > .script-jsonforms__control) {
    display: contents;
  }

  :deep(.script-jsonforms__control-shell > .script-jsonforms__control > .script-jsonforms__description) {
    display: none;
  }

  :deep(.script-jsonforms__label),
  :deep(.script-jsonforms__group-label),
  :deep(.script-jsonforms__array-label) {
    color: var(--color-text-primary);
    font-weight: 500;
    line-height: 18px;
  }

  :deep(.script-jsonforms__label) {
    min-width: 0;
    grid-area: label;
    overflow-wrap: anywhere;
  }

  :deep(.script-jsonforms__wrapper) {
    min-width: 0;
    grid-area: control;
  }

  :deep(.script-jsonforms__asterisk) {
    margin-left: 2px;
    color: #e5484d;
  }

  :deep(.script-jsonforms__input:not([type='checkbox'])),
  :deep(.script-jsonforms__select) {
    box-sizing: border-box;
    width: 100%;
    height: 32px;
    padding: 5px 10px;
    border: 1px solid var(--color-border-primary);
    border-radius: 10px;
    outline: 0;
    color: var(--color-text-primary);
    background: var(--color-bg-primary);
    font-family: inherit;
    font-size: 14px;
    line-height: 20px;
  }

  :deep(.script-jsonforms__input:not([type='checkbox'])::placeholder) {
    color: var(--color-text-disabled);
  }

  :deep(.script-jsonforms__input:not([type='checkbox']):enabled:hover),
  :deep(.script-jsonforms__select:enabled:hover) {
    border-color: var(--color-border-primary);
    background: var(--color-bg-secondary-hover);
  }

  :deep(.script-jsonforms__textarea) {
    box-sizing: border-box;
    width: 100%;
    min-height: 76px;
    padding: 8px 10px;
    resize: vertical;
    border: 1px solid #d6d6d6;
    border-radius: 10px;
    outline: 0;
    color: #141414;
    background: #fcfcfc;
    font: inherit;
    line-height: 20px;
  }

  :deep(.script-jsonforms__input:not([type='checkbox']):focus),
  :deep(.script-jsonforms__select:focus) {
    border-color: var(--color-border-primary-inverse);
    background: var(--color-bg-primary);
    box-shadow: none;
  }

  :deep(.script-jsonforms__textarea:focus) {
    border-color: var(--color-border-primary-inverse);
    box-shadow: none;
  }

  :deep(.script-jsonforms__input[type='checkbox']) {
    width: 16px;
    height: 16px;
    margin: 1px 0;
    accent-color: #141414;
  }

  :deep(.script-jsonforms__description),
  :deep(.script-jsonforms__array-empty) {
    color: var(--color-text-quaternary);
    font-size: 12px;
    line-height: 18px;
    white-space: pre-line;
  }

  :deep(.script-jsonforms__description) {
    min-width: 0;
    grid-area: description;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  :deep(.script-jsonforms__error) {
    min-width: 0;
    grid-area: error;
    color: #c62a2f;
    font-size: 12px;
    line-height: 18px;
  }

  &:not(.script-jsonforms--show-errors) {
    :deep(.script-jsonforms__control:not(.script-jsonforms__control--touched) > .script-jsonforms__error) {
      display: none;
    }
  }

  :deep(.script-jsonforms__control-shell:has(.script-jsonforms__input[type='checkbox'])) {
    grid-template-areas:
      'control label'
      '. description'
      '. error';
    grid-template-columns: 16px minmax(0, 1fr);
    column-gap: 4px;
  }

  :deep(.script-jsonforms__group),
  :deep(.script-jsonforms__array) {
    min-width: 0;
    margin: 0;
    padding: 0 0 0 12px;
    border: 0;
    border-left: 2px solid #d6d6d6;
  }

  :deep(.script-jsonforms__group-label),
  :deep(.script-jsonforms__array-legend) {
    margin: 0 0 10px;
    padding: 0;
  }

  :deep(.script-jsonforms__group-item + .script-jsonforms__group-item) {
    margin-top: 12px;
  }

  :deep(.script-jsonforms__array-legend) {
    display: flex;
    width: 100%;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  :deep(.script-jsonforms__array-add),
  :deep(.script-jsonforms__array-action) {
    display: inline-flex;
    width: 28px;
    height: 28px;
    align-items: center;
    justify-content: center;
    padding: 0;
    border: 1px solid #d6d6d6;
    border-radius: 8px;
    color: #525252;
    background: #fcfcfc;
    cursor: pointer;
    outline: 0;
  }

  :deep(.script-jsonforms__array-add) {
    order: 2;
    font-size: 18px;
  }

  :deep(.script-jsonforms__array-item-wrapper + .script-jsonforms__array-item-wrapper) {
    margin-top: 8px;
  }

  :deep(.script-jsonforms__array-item) {
    min-width: 0;
    border: 1px solid #e5e5e5;
    border-radius: 8px;
    background: #fcfcfc;
    overflow: hidden;
  }

  :deep(.script-jsonforms__array-toolbar) {
    display: flex;
    min-height: 36px;
    align-items: center;
    gap: 4px;
    padding: 4px 6px 4px 10px;
    cursor: pointer;
  }

  :deep(.script-jsonforms__array-item-label) {
    min-width: 0;
    flex: 1;
    color: #525252;
    font-size: 12px;
  }

  :deep(.script-jsonforms__array-action) {
    width: 24px;
    height: 24px;
    border: 0;
    background: transparent;
    font-family: Arial, sans-serif;
    font-size: 14px;
    line-height: 1;
  }

  :deep(.script-jsonforms__array-add:focus-visible),
  :deep(.script-jsonforms__array-action:focus-visible) {
    box-shadow: 0 0 0 2px rgb(0 0 0 / 8%);
  }

  :deep(.script-jsonforms__array-action:disabled) {
    opacity: 0.35;
    cursor: not-allowed;
  }

  :deep(.script-jsonforms__array-action--delete) {
    color: #c62a2f;
  }

  :deep(.script-jsonforms__array-content) {
    display: none;
    padding: 0 10px 10px;
  }

  :deep(.script-jsonforms__array-content--expanded) {
    display: block;
  }

  :deep(.script-jsonforms__dialog) {
    width: min(360px, calc(100vw - 32px));
    padding: 20px;
    border: 1px solid #d6d6d6;
    border-radius: 12px;
    color: #141414;
    background: #fcfcfc;
  }

  :deep(.script-jsonforms__dialog-title) {
    margin: 0;
    font-size: 16px;
  }

  :deep(.script-jsonforms__dialog-body) {
    color: #525252;
  }

  :deep(.script-jsonforms__dialog-actions) {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }

  :deep(.script-jsonforms__dialog-button) {
    height: 32px;
    padding: 0 12px;
    border: 1px solid #d6d6d6;
    border-radius: 8px;
    color: #141414;
    background: #fcfcfc;
  }

  :deep(.script-jsonforms__dialog-button--primary) {
    border-color: #141414;
    color: #fff;
    background: #141414;
  }

  :deep(input:disabled),
  :deep(select:disabled),
  :deep(textarea:disabled),
  :deep(button:disabled) {
    color: #a3a3a3;
    background: #ededed;
  }
}

.script-jsonforms__schema-error {
  margin: 0;
  color: #c62a2f;
  font-size: 12px;
  line-height: 18px;
  overflow-wrap: anywhere;
}
</style>
