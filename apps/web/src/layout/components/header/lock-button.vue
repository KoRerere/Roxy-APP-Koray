<template>
  <template v-if="!!lockData.password">
    <RxButton icon="base/rx_ic_unlock2" severity="secondary" outlined size="xs" @click="handleOpenLocker" />
    <Divider class="!ma-0" layout="vertical" />
  </template>
</template>

<script setup lang="ts">
import { useLock } from '/@/stores/lock'

const { lockData, setLockData } = useLock()

const handleOpenLocker = () => {
  setLockData({ openScreenLock: true })
}

</script>

<style lang="scss" module="lockScreen">
.mask {
  background: var(--Colors-background-bg-blur, rgba(255, 255, 255, 0.60)) !important;
  backdrop-filter: blur(30px);
  display: block !important;
}

.mask-root {
  position: absolute;
  width: 100%;
  height: 100%;
  // 重置一些样式
  background-color: transparent;
  border: none;
  box-shadow: none;
  max-height: 100% !important;
}

.mask-content {
  height: 100%;
  width: 100%;
}
</style>