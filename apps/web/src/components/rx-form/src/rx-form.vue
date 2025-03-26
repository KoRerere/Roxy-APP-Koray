<script setup lang="ts">
import type { FormSchema } from './types/form'
import { rxFormEmits, rxFormProps } from './form'
import FormItem from './rx-form-item.vue'
import { createFormContext, useFormMethods } from './hooks'
import { useFormState } from './hooks/useFormState'

const props = defineProps(rxFormProps)
const emit = defineEmits(rxFormEmits)

const formState = useFormState({ props, emit })
const { formModel, validationSchema, errors, innerFormSchemas } = formState

createFormContext({
  formState,
  formProps: props,
})

const formMethods = useFormMethods({ emit })
const { resetFields, handleSubmit } = formMethods

defineExpose({
  ...formState,
  ...formMethods,
  submit: handleSubmit,
})
</script>

<template>
  <form class="rx-form" @submit="handleSubmit">
    <template v-for="item in innerFormSchemas" :key="item.field">
      <FormItem v-model="formModel[item.field]" v-model:errors="errors" :schema="item" :validation-schema />
    </template>
    <div v-if="footer" class="footer">
      <slot name="footer">
        <div class="label" />
        <div class="buttons">
          <RxButton label="Submit" type="submit" />

          <RxButton label="Reset" type="button" class="p-button-secondary" @click="resetFields" />
        </div>
      </slot>
    </div>
  </form>
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
