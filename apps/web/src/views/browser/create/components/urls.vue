<script setup lang="ts">
import { $t } from '/@/locales'
import rxInputTextarea from '/@/components/ry-form/rx-input-textarea.vue'

const modelValue = defineModel<string[]>({ default: [] })

const urlsText = ref('')

watch(modelValue, (value) => {
  urlsText.value = value.join('\n')
}, { immediate: true })

function onBlur() {
  modelValue.value = urlsText.value.split('\n').filter((url) => {
    try {
      new URL(url)
      return true
    }
    catch (error) {
      return false
    }
  })
}
</script>

<template>
  <div class="flex-1 flex flex-col gap-2">
    <rxInputTextarea
      v-model="urlsText"
      rows="4"
      @blur="onBlur"
    />
    <div class="direct">
      {{ $t('* 换行可以添加多个') }}
    </div>
  </div>
</template>

<style lang="scss" scoped></style>
