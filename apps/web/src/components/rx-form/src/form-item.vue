<script setup lang="tsx">
import type { ZodObject } from 'zod'
import { isFunction, isPlainObject, isString } from 'es-toolkit'
import { isVNode } from 'vue'
import type { CustomRenderFn, FormSchema, RenderCallbackParams } from './types/form'
import { componentMap } from './componentMap'
import { useFormContext } from './hooks'

const props = defineProps({
  schema: {
    type: Object as PropType<FormSchema>,
    required: true,
  },
  validationSchema: {
    type: Object as PropType<ZodObject<any>>,
    required: true,
  },
})
const modelValue = defineModel()
const errors = defineModel('errors', {
  type: Object,
  default: {},
})

const { formProps, formState } = useFormContext()
const id = useId()

const compId = computed(() => {
  return `${props.schema.field}-${id}`
})

/** 触发校验的事件名称 */
const triggerEventName = computed(() => {
  return props.schema.rule?.trigger || 'change'
})

watch(modelValue, () => {
  validateField()
})

/**
 * @description 当前表单项组件
 */
const getComponent = computed(() => {
  const component = props.schema.component
  return isString(component)
    ? componentMap[component] ?? vnodeFactory(component)
    : vnodeFactory(component)
})

const getValues = computed<RenderCallbackParams>(() => {
  const { schema } = props
  const { formModel } = formState

  return {
    field: schema.field,
    formModel,
    schema,
  }
})

function vnodeFactory(component: FormSchema['componentSlots'] | FormSchema['component'], values = getValues.value) {
  if (isString(component)) {
    return <>{component}</>
  }
  else if (isVNode(component)) {
    return component
  }
  else if (isFunction(component)) {
    return vnodeFactory((component as CustomRenderFn)(values))
  }
  else if (component && isPlainObject(component)) {
    const compKeys = Object.keys(component)
    // 如果是组件对象直接return
    if (compKeys.some(n => n.startsWith('_') || ['setup', 'render'].includes(n))) {
      return component
    }
    return compKeys.reduce<Recordable<CustomRenderFn>>((slots, slotName) => {
      slots[slotName] = (...rest: any) => vnodeFactory(component[slotName], ...rest)
      return slots
    }, {})
  }
  return component
}

const labelAlign = computed(() => {
  if (formProps.layout === 'horizontal') {
    return formProps.labelAlign === 'right' ? 'flex-end' : ''
  }
  return ''
})

const getComponentProps = computed(() => {
  const compProps: Recordable = {}

  return {
    inputClass: 'w-full',
    invalid: Boolean(errors.value[props.schema.field]),
    ...compProps,
    ...props.schema.componentProps,
  }
})

const LabelComponent = computed(() => {
  return isFunction(props.schema.label) ? props.schema.label : () => props.schema.label
})

const getPlaceholder = computed(() => {
  const { placeholder } = getComponentProps.value
  return isFunction(placeholder) ? placeholder() : placeholder
})

/**
 * 单独验证某个字段
 */
function validateField() {
  const field = props.schema.field
  /**
   * 提取单字段的 schema
   */
  const singleFieldSchema = props.validationSchema.pick({ [field]: true })
  const result = singleFieldSchema.safeParse({ [field]: modelValue.value })

  // 清除之前的错误信息
  errors.value[field] = ''

  // 如果验证失败，保存错误消息
  if (!result.success) {
    errors.value[field] = result.error.errors[0].message
  }
}

onMounted(async () => {
  if (props.schema.componentProps?.request) {
    props.schema.componentProps.options = await props.schema.componentProps.request()
  }
})
</script>

<template>
  <div class="field">
    <div class="form-item-row" :class="formProps.layout">
      <label v-if="schema.label" :for="compId" :class="{ colon: formProps.colon }">
        <component :is="LabelComponent" />
      </label>
      <div class="form-item-control">
        <component :is="getComponent" v-bind="getComponentProps" :id="compId" v-model="modelValue"
          :placeholder="getPlaceholder" class="w-full" :class="{ 'p-invalid': errors[schema.field] }"
          @[triggerEventName]="validateField" />
        <Message v-if="errors[schema.field] || !schema.label" severity="error" size="small" variant="simple" class="error-message">
          {{ errors[schema.field] }}
        </Message>
        <component v-if="schema.description" :is="schema.description" />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.field {
  &:last-of-type {
    .form-item-control {
      .error-message {
        min-height: auto;
      }
    }
  }
}

.form-item-control {
  flex: auto;
  display: flex;
  flex-direction: column;

  .p-inputtext::placeholder {
    color: var(--Component-Colors-TextInput-text-text-placeholder, #7c8387);
  }

  .error-message {
    min-height: 16px;
  }
}

label {
  display: flex;
  align-items: center;
  height: 32px;
  justify-content: v-bind('labelAlign');

  &.colon::after {
    content: ':';
    position: relative;
    margin-block: 0;
    margin-inline-start: 2px;
    margin-inline-end: 8px;
  }
}

.p-error {
  height: 22px;
  display: block;
  color: red;
}

.form-item-row {
  display: flex;

  &.vertical {
    flex-direction: column;
  }

  &.horizontal label {
    width: v-bind('formProps.labelWidth');
  }
}
</style>
