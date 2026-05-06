<script setup lang="tsx">
import SlotMachine from '/@/views/campaign/freedom/SlotMachine/index.vue'
import RxButton from '/@/components/rx-button'
import { useDialog } from '/@/hooks/useDialog'

const [showDialog] = useDialog()

function openDialog() {
  showDialog({
    modal: true,
    blockScroll: true,
    style: {
      width: '480px',
    },
    slots: {
      container: ({ hideModal }) => (
        <SlotMachine hideModal={hideModal} />
      ),
    },
  })
}
</script>

<template>
  <div class="w-300px">
    <RxButton @click="openDialog">
      老虎机
    </RxButton>
  </div>
</template>
