<script setup lang="ts">
import type { FormSchema } from '../src/types/form'
import { useToast } from 'primevue/usetoast'
import { reactive } from 'vue'
import { formSchemas } from './schemas'
import { RxForm } from '/@/components/rx-form/'

const toast = useToast()

function handleSubmit(value) {
  console.log('value', value)
  toast.add({
    severity: 'success',
    summary: 'Success',
    detail: 'Form submitted',
    life: 3000,
  })
}
</script>

<template>
  <RxForm :schemas="formSchemas" label-width="160px" @submit="handleSubmit" />
</template>

<style scoped>
.p-field {
  margin-bottom: 1rem;
}
.p-error {
  color: red;
}
</style>
