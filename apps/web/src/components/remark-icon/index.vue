<script setup lang="ts">
import { useDialog } from 'primevue/usedialog'
import { RxSvgIcon } from '/@/components/rx-icon/'
import simplePopup from '/@/components/simplePopup'
import { $t } from '/@/locales'

const props = defineProps({
  value: String,
  title: String,
  content: String,
  placeholder: String,
  label: String,
  mode: {
    type: String as PropType<'icon' | 'button'>,
    default: 'icon',
  },
  disabled: {
    type: Boolean,
    default: false,
  },
  onConfirm: {
    type: Function,
    default: () => { },
  },
  onCancel: {
    type: Function,
    default: () => { },
  },
})

const hasRemark = computed(() => props.value)

const dialog = useDialog()

function onRemark() {
  if (props.disabled) {
    return
  }

  dialog.open(simplePopup, {
    props: {
      showHeader: false,
      modal: true,
      blockScroll: true,
    },
    data: {
      props: {
        title: props.title,
        content: props.content,
        inputs: [
          {
            type: 'textarea',
            name: 'remark',
            placeholder: props.placeholder || $t('请输入备注'),
            value: props.value,
          },
        ],
      },
      onConfirm: async (formData: any) => {
        await props.onConfirm(formData.remark)
      },
      onCancel: () => {
        props.onCancel()
      },
    },
  })
}
</script>

<template>
  <RxButton v-if="mode === 'button'" v-tooltip.top="value" class="!gap-0 !font-size-0 !min-w-auto" :disabled="disabled" outlined severity="secondary" @click.stop="onRemark">
    <RxSvgIcon :name="hasRemark ? 'base/rx_ic_doc_fill' : 'base/rx_ic_doc_add'" :class="{ disabled, 'light': hasRemark }" />
    <span v-if="label" class="ml-2 text-[12px] ellipsis-1">{{ label }}</span>
    <!-- 占位用span用于保持按钮的高度 -->
    <span class="p-button-label" data-pc-section="label">&nbsp;</span>
  </RxButton>
  <RxSvgIcon v-else v-tooltip.top="value" :name="hasRemark ? 'base/rx_ic_doc_fill' : 'base/rx_ic_doc_add'" :class="{ disabled, 'light': hasRemark }" @click.stop="onRemark" />
</template>

<style lang="scss" scoped>
.light {
  color: var(--colors-icon-icon-brand, #12a3fc);
}

.disabled:not(.light) {
  color: var(--colors-icon-icon-inactive, #989CA0);
  cursor: not-allowed;
}
</style>
