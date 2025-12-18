<script setup lang="ts">
import TsFormInputText from '/@/views/lab/components/form/m-input-text.vue'

defineOptions({ inheritAttrs: false })
const modelValue = defineModel<string>()
const attrs = useAttrs()
</script>

<template>
  <TsFormInputText v-model="modelValue" v-bind="attrs">
    <template #preIcon>
      <div v-tooltip.top="$t('暂时仅支持中国大陆手机号')" class="flex items-center gap-2 cursor-default">
        <SvgIcon name="base/rx_ic_phone" />
        <div class="num">
          +86
        </div>
        <div class="line" />
      </div>
    </template>
  </TsFormInputText>
</template>

<style lang="scss" scoped>
:deep(.p-inputtext) {
  padding-left: 84px !important;
}

.num {
  color: var(--colors-text-text-primary);
  font-size: 14px;
  font-weight: 500;
  letter-spacing: 0.14px;
}

.line {
  width: 1px;
  height: 16px;
  background-color: var(--colors-border-border-subtle);
}
</style>
