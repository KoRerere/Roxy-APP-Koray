<script setup lang="ts">
import { $t } from '/@/locales'
import rxInputTextarea from '/@/components/ry-form/rx-input-textarea.vue'

defineOptions({
  inheritAttrs: false,
})

const attrs = useAttrs()

const modelValue = defineModel<string[]>({ default: [] })
const invalid = defineModel('invalid', { default: false })
const urlsText = ref('')
const showUrls = ref(!!modelValue.value.length)

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
  } catch (err) {
    console.error(err)
    invalid.value = true
  }
}
</script>

<template>
  <div class="flex-1 flex flex-col gap-2">
    <div class="flex items-center self-stretch gap-2">
      <div class="flex-1 items-center flex gap-2 title">{{ attrs.label }}</div>
      <RxButton text size="xxs" severity="secondary" icon="base/rx_ic_plus" :label="$t('新增 URLs')" @click="showUrls = true" />
    </div>
    <rxInputTextarea v-show="showUrls" v-model="urlsText" rows="3" :placeholder="$t('必须以 http:// 或 https:// 开头\n每行一个 URL，换行以添加多个')" :invalid="invalid" @blur="onBlur" />
    <Message v-if="invalid" severity="error" size="small" variant="simple">{{ $t('URL格式有误，必须以 http:// 或 https:// 开头') }}</Message>
  </div>
</template>

<style lang="scss" scoped>
.title {
  color: var(--colors-text-text-primary);
  font-size: 16px;
  font-weight: 600;
  line-height: 16px;
}
</style>
