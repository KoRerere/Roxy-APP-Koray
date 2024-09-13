<script setup lang="ts">
import { validate } from 'class-validator'
import { reactive, ref } from 'vue'
import type { ValidationError } from 'class-validator'
import { UserForm } from './models/UserForm' // 导入表单验证类
import { useToast } from 'primevue/usetoast'

const toast = useToast()

// 创建表单数据和错误对象
const formData = reactive(new UserForm())
const errors = reactive<Record<string, any>>({})

/**
 * 单独验证某个字段的函数
 */
/**
 * 只验证当前字段
 */
async function validateField(field: keyof UserForm) {
  const validationErrors: ValidationError[] = await validate(formData, { skipMissingProperties: true })

  // 清除当前字段的错误
  errors[field] = ''

  // 查找与当前字段相关的错误并更新
  validationErrors.forEach((error) => {
    if (error.property === field) {
      errors[field] = Object.values(error.constraints || {})[0]
    }
  })
}

/**
 * 提交表单并验证所有字段
 */
async function onSubmit() {
  const validationErrors: ValidationError[] = await validate(formData)

  // 清除所有错误
  Object.keys(errors).forEach((key) => {
    errors[key as keyof UserForm] = ''
  })

  if (validationErrors.length > 0) {
    validationErrors.forEach((error) => {
      const field = error.property as keyof UserForm
      errors[field] = Object.values(error.constraints || {})[0]
    })
  }
  else {
    toast.add({ severity: 'success', summary: 'Form Submitted', detail: 'Success!', life: 5000 })
  }
}
</script>

<template>
  <div class="p-fluid">
    <h2>User Registration Form</h2>

    <div class="p-field">
      <label for="name">Name</label>
      <InputText id="name" v-model="formData.user_name" @blur="validateField('user_name')" />
      <small v-if="errors.user_name" class="p-error">{{ errors.user_name }}</small>
    </div>

    <div class="p-field">
      <label for="email">Email</label>
      <InputText id="email" v-model="formData.email" @blur="validateField('email')" />
      <small v-if="errors.email" class="p-error">{{ errors.email }}</small>
    </div>

    <div class="p-field">
      <label for="password">Password</label>
      <InputText id="password" v-model="formData.password" @blur="validateField('password')" />
      <small v-if="errors.password" class="p-error">{{ errors.password }}</small>
    </div>

    <Button label="Submit" @click="onSubmit" />
  </div>
</template>

<style scoped>
.p-field {
  margin-bottom: 1rem;
}
.p-error {
  color: red;
}
</style>
