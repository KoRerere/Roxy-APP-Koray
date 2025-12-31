<script setup lang="ts">
import { RxSvgIcon } from '/@/components/rx-icon/'
import { useSimpleDialog } from '/@/components/simplePopup'


interface Props {
  value?: string
  title?: string
  content?: string
  placeholder?: string
  label?: string
  mode?: 'icon' | 'button'
  disabled?: boolean
  onConfirm?: (formData: any) => Promise<void> | void
  onCancel?: () => void
}

const props = defineProps<Props>()

const { showSimpleDialog } = useSimpleDialog()

const hasRemark = computed(() => props.value)

function onRemark() {
  if (props.disabled) return

  showSimpleDialog({
    title: props.title,
    content: props.content,
    inputs: [
      {
        type: 'textarea',
        name: 'remark',
        value: props.value,
        props: {
          placeholder: props.placeholder || $t('请输入备注'),
          rows: 6,
        }
      },
    ],
    onConfirm: async (formData: any) => {
      await props.onConfirm?.(formData.remark)
    },
    onCancel: props.onCancel,
  })
}
</script>

<template>
  <RxButton v-if="mode === 'button'" v-tooltip.top="value" class="!gap-0 !text-0 !min-w-auto" :disabled="disabled" outlined severity="secondary" @click.stop="onRemark">
    <RxSvgIcon :name="hasRemark ? 'base/rx_ic_doc_fill' : 'base/rx_ic_doc_add'" :class="{ disabled, 'light': hasRemark }" />
    <span v-if="label" class="ml-2 text-[12px] ellipsis-1">{{ label }}</span>
    <!-- 占位用span用于保持按钮的高度 -->
    <span class="p-button-label" data-pc-section="label">&nbsp;</span>
  </RxButton>
  <RxSvgIcon v-else v-tooltip.top="value" :name="hasRemark ? 'base/rx_ic_doc_fill' : 'base/rx_ic_doc_add'" :class="{ disabled, 'light': hasRemark }" @click.stop="onRemark" />
</template>

<style lang="scss" scoped>
.light {
  color: var(--colors-icon-icon-brand);
}

.disabled:not(.light) {
  color: var(--colors-icon-icon-inactive);
  cursor: not-allowed;
}
</style>
