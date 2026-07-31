<script setup lang="ts">
import RxInputTextarea from '/@/components/ry-form/rx-input-textarea.vue'

defineOptions({
  inheritAttrs: false,
})

const attrs = useAttrs()

const modelValue = defineModel<string[]>({ default: [] })
const invalid = defineModel('invalid', { default: false })
const urlsText = ref('')

watch(modelValue, (value) => {
  urlsText.value = value.join('\n')
}, { immediate: true })

function onBlur() {
  const currUrls = urlsText.value.split('\n').filter(url => !!url)
  try {
    for (let i = 0; i < currUrls.length; i++) {
      void new URL(currUrls[i])
    }
    modelValue.value = currUrls
    invalid.value = false
  }
  catch (err) {
    console.error(err)
    invalid.value = true
  }
}
</script>

<template>
  <div class="flex min-w-0 w-full" :class="attrs.class">
    <div class="mr-2 shrink-0 tt-primary text-3.25 leading-32px rx-label">
      {{ attrs.label }}
    </div>
    <div class="min-w-0 flex-1">
      <RxInputTextarea v-model="urlsText" rows="3" :placeholder="$t('必须以 http:// 或 https:// 开头\n每行一个 URL，换行以添加多个')" :invalid="invalid" @blur="onBlur" />
      <Message v-if="invalid" severity="error" size="small" variant="simple">
        {{ $t('URL格式有误，必须以 http:// 或 https:// 开头') }}
      </Message>
    </div>
  </div>
</template>

<style lang="scss" scoped></style>
