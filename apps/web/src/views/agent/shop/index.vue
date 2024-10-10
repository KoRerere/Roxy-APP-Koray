<script setup>
import { ref } from 'vue'

const today = new Date()
const month = today.getMonth()
const year = today.getFullYear()
const nextMonth = (month === 11) ? 0 : month + 1
const nextYear = (nextMonth === 0) ? year + 1 : year

const date = ref()
const maxDate = ref(new Date())

// maxDate.value.setMonth(nextMonth)
// maxDate.value.setFullYear(nextYear)
</script>

<template>
  <div class="card flex justify-center">
    <DatePicker v-model="date" :max-date="today" :manual-input="false" />
  </div>
</template>
