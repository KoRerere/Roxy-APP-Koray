<script setup lang="ts">
import { useDialog } from 'primevue/usedialog'
import { RxSvgIcon } from '/@/components/rx-icon/'
import popup from '/@/components/simplePopup'

const props = defineProps({
  value: String,
  rows: {
    type: Array,
    default: () => [],
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

const emit = defineEmits(['onConfirm', 'onCancel'])

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
        title: 'Install via Chrome Store',
        content: 'Please paste the chrome extension URL down below then click the install button.',
        inputs: [
          {
            type: 'text',
            name: 'remark',
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
  <div class="flex items-center">
    <RxSvgIcon v-tooltip.top="value" name="base/rx_ic_doc_add" class="remark-icon cursor-pointer" :size="16"
      :class="{ 'text-gray-200': disabled, 'active': hasRemark }" @click.stop="onRemark" />
  </div>
</template>

<style lang="scss" scoped>
.remark-icon:active:not(.text-gray-200) {
  color: orange;
}

.active {
  color: orange;
}
</style>
