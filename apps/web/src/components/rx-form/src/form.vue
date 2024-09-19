<script setup lang="ts">
import type { FormSchema } from './types/form'
import { formEmits, formProps } from './form'
import FormItem from './form-item.vue'
import { createFormContext } from './hooks'
import { useFormState } from './hooks/useFormState'

const props = defineProps(formProps)
const emit = defineEmits(formEmits)

const formState = useFormState({ props })
const { formModel, validationSchema, errors } = formState

createFormContext({
  formState,
  formProps: props,
})
// const { defineField, handleSubmit, resetForm, errors } = useForm({
//   validationSchema: schema,
// });

/**
 * 提交表单并验证所有字段
 */
function onSubmit() {
  const result = validationSchema.value.safeParse(formModel.value)
  console.log('result', result)
  // 清除所有字段的错误信息
  Object.keys(errors.value).forEach((key) => {
    errors.value[key] = ''
  })

  // 表单验证失败，更新错误信息
  if (!result.success) {
    // 遍历错误并更新错误信息
    result.error.errors.forEach((error) => {
      const field = error.path[0]
      errors.value[field] = error.message
    })
    return Promise.reject(errors.value)
  }
  else {
    emit('submit', formModel.value)
    return Promise.resolve(formModel.value)
  }
}

function resetForm() {
  Object.keys(formModel.value).forEach((key) => {
    formModel.value[key] = ''
  })
  Object.keys(errors.value).forEach((key) => {
    errors.value[key] = ''
  })
  emit('reset')
}

defineExpose({
  formModel,
  errors,
  submit: onSubmit,
  resetForm,
})
</script>

<template>
  <div class="rx-form">
    <template v-for="item in schemas" :key="item.field">
      <FormItem v-model="formModel[item.field]" v-model:errors="errors" :schema="item" :validation-schema />
    </template>
    <div v-if="footer" class="footer">
      <slot name="footer">
        <div class="label" />
        <div class="buttons">
          <Button label="Submit" type="submit" @click="onSubmit" />

          <Button
            label="Reset"
            type="button"
            class="p-button-secondary"
            @click="resetForm"
          />
        </div>
      </slot>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.rx-form {
  width: 100%;
}
label {
  display: block;
  margin-top: 20px;
  margin-bottom: 4px;
}

.footer {
  display: flex;

  .buttons {
    display: flex;
    gap: 12px;
  }
  .label {
    width: v-bind(labelWidth);
  }
}

.p-error {
  display: block;
}
</style>
