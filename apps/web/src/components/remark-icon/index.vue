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
    emits: {
      onConfirm: ([formData, close]: [any, close: () => void]) => {
        emit('onConfirm', [formData.remark, close, props.rows])
      },
      onCancel: () => emit('onCancel'),
    },
  })
}
</script>

<template>
  <div v-tooltip.top="value" class="flex items-center cursor-pointer" @click.stop="onRemark">
    <RxSvgIcon name="base/rx_ic_doc_add" class="remark-icon"
      :class="{ 'text-gray-200': disabled, 'active': hasRemark }" />
  </div>
</template>

<style lang="scss" scoped>
.remark-icon {
  width: 16px;
  height: 16px;

  &:active:not(.text-gray-200) {
    color: orange;
  }
}

.active {
  color: orange;
}
</style>
