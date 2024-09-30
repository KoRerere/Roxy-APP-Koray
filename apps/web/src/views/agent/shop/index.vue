<script setup lang="ts">
const showMessage = ref(false)

function closeMessage() {
  setTimeout(() => {
    showMessage.value = false
  }, 300)
}
</script>

<template>
  <div class="pa-50">
    <Button label="Detect" @click="showMessage = true" />

    <RxMessage v-if="showMessage" icon="status/rx_ic_check_fill" severity="success" closable
      :pt="{ content: '!items-start' }" @close="closeMessage">
      <div class="text-3 color-[#171C1F]">
        Detection passed
      </div>
      <div class="text-3 line-height-normal color-[#575D61]">
        Location: HK/HongKong
      </div>
      <div class="text-3 line-height-normal color-[#575D61]">
        IP: 2600:1700:cc70:7580:b8c4:3fe5:88ee:9
      </div>
    </RxMessage>
  </div>
</template>

<style scoped></style>
