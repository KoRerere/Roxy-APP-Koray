<script setup lang="tsx">
import SlotMachine from '/@/views/campaign/freedom/SlotMachine/index.vue'
import RxButton from '/@/components/rx-button'
import { useDialog } from '/@/hooks/useDialog'
import Loading from './loading.vue'

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
    <!-- <RxButton @click="openDialog">
      老虎机
    </RxButton> -->
    <div class="relative bg-[var(--colors-background-bg-block)] size-140px">
      <div class="size-12 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
        <Loading />
      </div>
    </div>
  </div>
</template>
