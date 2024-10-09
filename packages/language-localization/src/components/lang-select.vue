<script lang="ts" setup>
import { inject } from 'vue'
import { ISO639 } from './ISO-639'

const modelValue = defineModel({
  type: String,
  default: '',
})

const { currentLangKeys } = inject('mainContext')
</script>

<template>
  <el-select v-model="modelValue" placeholder="Select" style="width: 240px">
    <el-option
      v-for="item in ISO639"
      :key="item.code"
      :label="`${item.icon} ${item.lang}`"
      :value="item.code"
      :disabled="currentLangKeys.includes(item.code)"
    >
      {{ item.icon }} {{ item.lang }}
    </el-option>
  </el-select>
</template>
