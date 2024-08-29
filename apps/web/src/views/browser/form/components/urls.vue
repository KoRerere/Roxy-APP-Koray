<script setup lang="ts">
import rxCard from '/@/components/rx-card'
import inputBase from '/@/components/ry-form/input-base.vue'
import { getFormData } from '/@/utils'

const emits = defineEmits(['update:modelValue'])

const urlInputs = ref<any>([])

function addInputs() {
  urlInputs.value.push({
    type: 'text',
    name: (new Date().getTime()).toString(32),
    value: '',
    placeholder: '请输入url',
    leftIcon: 'mdi mdi-link',
  })
}

function deleteInput(index: number) {
  urlInputs.value.splice(index, 1)
}

function onBlur() {
  try {
    const formData = getFormData(urlInputs.value)
    emits('update:modelValue', Object.values(formData))
  }
  catch (error) {
    console.log('🚀 ~ onBlur ~ error:', error)
  }
}
</script>

<template>
  <div class="flex flex-row">
    <input-label v-bind="$attrs" />
    <div class="flex-1">
      <ry-button size="small" severity="secondary" icon="mdi mdi-plus" label="Add URLs" @click="addInputs" />
      <div class="inputs">
        <rxCard v-for="(input, index) in urlInputs" :key="input.name" class="inputs-item" @close="deleteInput(index)">
          <inputBase v-model="input.value" v-bind="input" @blur="onBlur" />
        </rxCard>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.inputs {
  &-item {
    padding: 0;
    border: none;
    margin-top: 10px;
  }
}
</style>
