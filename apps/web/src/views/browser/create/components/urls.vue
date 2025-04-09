<script setup lang="ts">
import { $t } from '/@/locales'
import rxInputTextarea from '/@/components/ry-form/rx-input-textarea.vue'

const modelValue = defineModel<string[]>({ default: [] })
const invalid = defineModel('invalid', { default: false })

const urlsText = ref('')

watch(modelValue, (value) => {
  urlsText.value = value.join('\n')
}, { immediate: true })

function onBlur() {
  const currUrls = urlsText.value.split('\n').filter(url => !!url);
  try {
    for (let i = 0; i < currUrls.length; i++) {
      new URL(currUrls[i])
    }
    modelValue.value = currUrls
    invalid.value = false
  } catch(err) {
    console.error(err)
    invalid.value = true
  }
}
</script>

<template>
  <div class="flex-1 flex flex-col gap-2">
    <rxInputTextarea
      v-model="urlsText"
      rows="4"
      @blur="onBlur"
      :placeholder="$t('必须以 http:// 或 https:// 开头')"
      :invalid="invalid"
    />
    <Message v-if="invalid" severity="error" size="small" variant="simple">{{
      $t('url格式有误，必须以 http:// 或 https:// 开头') }}
    </Message>
    <div class="direct">
      {{ $t('* 换行可以添加多个') }}
    </div>
  </div>
</template>

<style lang="scss" scoped></style>
