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
  <div class="cursor-pointer" :class="{ 'mode-button': mode === 'button' }" @click.stop="onRemark">
    <RxSvgIcon v-tooltip.top="value" name="base/rx_ic_doc_add" class="remark-icon"
      :class="{ 'text-gray-200': disabled, 'active': hasRemark }" />
  </div>
</template>

<style lang="scss" scoped>
.remark-icon:active:not(.text-gray-200) {
  color: orange;
}

.active {
  color: orange;
}

.mode-button {
  display: flex;
  padding: var(--p-button-sm-padding-y) var(--p-button-sm-padding-x);
  color: var(--p-button-outlined-secondary-color);
  background: transparent;
  border: 1px solid var(--p-button-secondary-border-color);
  border-color: var(--p-button-outlined-secondary-border-color);
  border-radius: var(--p-button-border-radius);
}
</style>
