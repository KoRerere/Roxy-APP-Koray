<script setup lang="ts">
import rxInputTextarea from '/@/components/ry-form/rx-input-textarea.vue'
import { $t } from '/@/locales'
import { checkCookieFormat, readCookiesFile } from '/@/utils'

defineOptions({
  inheritAttrs: false,
})

const attrs = useAttrs()

const modelValue = defineModel<string>()
const invalid = defineModel('invalid', { default: false })
const errorMsg = ref($t('Cookie 格式错误，请检查格式'))

async function onIconClick() {
  const res = await readCookiesFile()
  if (res) {
    if (res.data) {
      modelValue.value = res.data
      invalid.value = false
    }
    else {
      invalid.value = true
      errorMsg.value = res.message
    }
  }
}

function onBlur(event: any) {
  if (checkCookieFormat(event.target.value)) {
    invalid.value = false
    return
  }

  invalid.value = true
  errorMsg.value = $t('Cookie 格式错误，请检查格式')
}
</script>

<template>
  <RxAccordion :class="attrs.class">
    <AccordionPanel value="open" :pt="{ root: 'border-dashed' }">
      <AccordionHeader as="div" #default="{ active }">
        <div class="flex items-center gap-3 header">
          <SvgIcon class="header-icon" :name="active ? 'base/rx_ic_minus' : 'base/rx_ic_plus'" size="20"></SvgIcon>
          <span>{{ attrs.label }}</span>
        </div>
      </AccordionHeader>
      <AccordionContent>
        <rxInputTextarea v-model="modelValue" rows="5" icon="base/rx_ic_attachment" :placeholder="$t('请以 JSON 格式输入 Cookies')" :auto-resize="false" :invalid="invalid" @iconClick="onIconClick"
          @blur="onBlur" />
        <Message v-if="invalid" severity="error" size="small" variant="simple">{{ errorMsg }}</Message>
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
