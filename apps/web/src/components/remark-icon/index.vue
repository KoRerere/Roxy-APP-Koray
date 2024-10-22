<script setup lang="ts">
import { useDialog } from 'primevue/usedialog'
import { RxSvgIcon } from '/@/components/rx-icon/'
import popup from '/@/components/simplePopup'

const props = defineProps({
  value: String,
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

  dialog.open(popup, {
    props: {
      showHeader: false,
      modal: true,
      blockScroll: true,
    },
    data: {
      props: {
        title: 'Add notes to profile',
        content: 'Please add notes down below.',
        inputs: [
          {
            type: 'textarea',
            name: 'remark',
            placeholder: 'Your notes here...',
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
  <RxButton v-if="mode === 'button'" v-tooltip.top="value" class="mode-button" :disabled="disabled" outlined severity="secondary" @click.stop="onRemark">
    <RxSvgIcon name="base/rx_ic_doc_add" class="remark-icon" :class="{ 'text-gray-200': disabled, 'active': hasRemark }" />
    <!-- 占位用span用于保持按钮的高度 -->
    <span class="p-button-label" data-pc-section="label">&nbsp;</span>
  </RxButton>
  <RxSvgIcon v-else v-tooltip.top="value" name="base/rx_ic_doc_add" class="remark-icon" :class="{ 'text-gray-200': disabled, 'active': hasRemark }" @click.stop="onRemark" />
</template>

<style lang="scss" scoped>
.remark-icon:active:not(.text-gray-200) {
  color: orange;
}

.active {
  color: orange;
}

.mode-button {
  font-size: 0;
  gap: 0;
}
</style>
