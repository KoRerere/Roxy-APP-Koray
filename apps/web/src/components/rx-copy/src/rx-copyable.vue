<script setup lang="ts">
import { getInnerText } from './_utils'

const isCopied = ref(false)
const slots = useSlots()
const rxTooltipRef = useTemplateRef('rxTooltipRef')

function handleCopy() {
  const children = slots.default?.() || []
  navigator.clipboard.writeText(getInnerText(children) || '')
  isCopied.value = true
  rxTooltipRef.value?.align?.()
  setTimeout(() => {
    isCopied.value = false
    rxTooltipRef.value?.align?.()
  }, 1000)
}
</script>

<template>
  <RxTooltip ref="rxTooltipRef" tooltip-content-class="px-2 py-1">
    <template #content>
      <span class="copy-tooltip-text">{{ isCopied ? $t('已复制') : $t('复制') }}</span>
    </template>
    <span class="cursor-pointer" @click="handleCopy"><slot /></span>
  </RxTooltip>
</template>

<style scoped>
  .copy-tooltip-text {
  color: var(--component-tooltip-text-primary, #fff);
  text-align: center;
  font-family: Inter;
  font-size: 12px;
  font-style: normal;
  font-weight: 600;
  line-height: var(--Line-Height-text-xs, 16px); /* 133.333% */
}
.copy-tooltip-content {
  padding: var(--spacing-sm, 4px) var(--spacing-lg, 8px);
}
</style>
