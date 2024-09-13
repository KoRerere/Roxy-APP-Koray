<script setup lang="ts">
import { useToast } from 'primevue/usetoast'
import { reactive } from 'vue'
import { z } from 'zod'

const toast = useToast()
// 响应式表单数据
const formData = reactive({
  user_name: '',
  email: '',
  password: '',
})

const errors = reactive({
  user_name: '',
  email: '',
  password: '',
})

// 使用 Zod 定义验证规则
const schema = z.object({
  user_name: z.string().min(2, 'Name must be at least 2 characters long').max(30, 'Name must be less than 30 characters').nonempty('Name is required'),
  email: z.string().email('Invalid email address').min(1, 'Email is required'),
  password: z.string().min(6, 'Password must be at least 6 characters').max(20, 'Password must be less than 20 characters').nonempty('Password is required'),
})

/**
 * 单独验证某个字段
 */
function validateField(field: keyof typeof formData) {
  /**
   * 提取单字段的 schema
   */
  const singleFieldSchema = schema.pick({ [field]: true })
  const result = singleFieldSchema.safeParse({ [field]: formData[field] })

  // 清除之前的错误信息
  errors[field] = ''

  // 如果验证失败，保存错误消息
  if (!result.success) {
    errors[field] = result.error.errors[0].message
  }
}

/**
 * 提交表单并验证所有字段
 */
function onSubmit() {
  const result = schema.safeParse(formData)

  // 清除所有字段的错误信息
  Object.keys(errors).forEach((key) => {
    errors[key as keyof typeof formData] = ''
  })

  if (!result.success) {
    // 遍历错误并更新错误信息
    result.error.errors.forEach((error) => {
      const field = error.path[0] as keyof typeof formData
      errors[field] = error.message
    })
  }
  else {
    // 表单验证通过，显示成功信息
    toast.add({ severity: 'success', summary: 'Form Submitted', detail: 'Success!' })
  }
}
</script>

<template>
  <div class="p-fluid">
    <h2>User Registration Form</h2>

    <div class="p-field">
      <label for="user_name">Name</label>
      <InputText id="user_name" v-model="formData.user_name" @blur="validateField('user_name')" />
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
