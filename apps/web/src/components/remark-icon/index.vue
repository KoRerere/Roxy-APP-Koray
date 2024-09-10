<script setup lang="ts">
import { useDialog } from 'primevue/usedialog'
import popup from '/@/components/simplePopup'

const props = defineProps({
  value: String,
  rows: {
    type: Array,
    default: () => [],
  },
})

const emit = defineEmits(['onConfirm', 'onCancel'])

const hasRemark = computed(() => props.value)

const dialog = useDialog()

function onRemark() {
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
  <div v-tooltip.top="value" class="cursor-pointer mdi mdi-file remark-icon" :class="{ active: hasRemark }"
    @click.stop="onRemark" />
</template>

<style lang="scss" scoped>
.remark-icon:active {
  color: orange;
}

.active {
  color: orange;
}
</style>
