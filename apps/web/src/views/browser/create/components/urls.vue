<script setup lang="ts">

import rxInputTextarea from '/@/components/ry-form/rx-input-textarea.vue'

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
  <RxAccordion :class="attrs.class">
    <AccordionPanel value="open" :pt="{ root: '!border-dashed' }">
      <AccordionHeader as="div" #default="{ active }">
        <div class="flex items-center gap-3 header">
          <SvgIcon class="header-icon" :name="active ? 'base/rx_ic_minus' : 'base/rx_ic_plus'" size="20"></SvgIcon>
          <span>{{ attrs.label }}</span>
        </div>
      </AccordionHeader>
      <AccordionContent>
        <rxInputTextarea v-model="urlsText" rows="3" :placeholder="$t('必须以 http:// 或 https:// 开头\n每行一个 URL，换行以添加多个')" :invalid="invalid" @blur="onBlur" />
        <Message v-if="invalid" severity="error" size="small" variant="simple">{{ $t('URL格式有误，必须以 http:// 或 https:// 开头') }}</Message>
      </AccordionContent>
    </AccordionPanel>
  </RxAccordion>
</template>

<style lang="scss" scoped>
.header {
  color: var(--colors-text-text-primary);
  font-size: 16px;
  font-weight: 600;
  line-height: 16px;

  &-icon {
    border: 1px solid var(--colors-border-border-base);
    border-radius: 4px;
    padding: 2px;
    background: var(--colors-background-bg-action);
  }
}
</style>
