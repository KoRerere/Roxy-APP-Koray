<script setup lang="ts">
import type { UserGetLoginInfoListData } from '@roxy/backend-api';
import { RxSvgIcon } from '/@/components/rx-icon'



const props = defineProps<{
  devices: UserGetLoginInfoListData['data']
}>()

const deviceIconMap = {
  win: 'platforms/rx_os_windows',
  mac: 'platforms/rx_os_macOS',
  ios: 'platforms/rx_os_iOS',
  android: 'platforms/rx_os_android',
}

const deviceList = computed(() => {
  return props.devices.map((item) => {
    return {
      ...item,
      deviceName: decodeURIComponent(item.deviceName || ''),
    }
  })
})

</script>

<template>
  <template v-for="item in deviceList" :key="item.id">
    <div class="device-item" :class="{ line: devices.length > 1 }">
      <div class="device-item__icon">
        <RxSvgIcon :name="deviceIconMap[item.platform] || 'base/rx_ic_browsers_fill'" size="24px" />
      </div>
      <div class="device-item__info">
        <div class="device-item__name">
          <span class="text-[color:--colors-text-text-primary]">{{ item.deviceName }}</span>
          <span class="text-[color:--colors-text-text-tertiary]">{{ item.createTime }}</span>
        </div>
        <div class="device-item__ip">
          {{ item.address }}
          <div class="h-[12px] overflow-hidden">|</div>
          {{ item.location }}
        </div>
      </div>
    </div>
  </template>
</template>

<style lang="scss" scoped>
.device-item {
  display: flex;
  align-items: center;
  gap: 11px;
  align-self: stretch;

  &:last-of-type.line {
    border-bottom: 0;
  }

  &.line {
    padding-bottom: var(--spacing-2xl, 16px);
    border-bottom: 1px solid var(--Colors-Border-border-container, #C7CDD1);

    &:not(:first-of-type) {
      padding-top: var(--spacing-2xl, 16px);
    }
  }

  .device-item__icon {
    display: flex;
    padding: 8px;
    align-items: center;
    gap: 10px;
    border-radius: 8px;
    border: 1px solid var(--Colors-Border-border-container, #C7CDD1);
  }

  .device-item__info {
    width: 100%;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--spacing-lg, 8px);

    .device-item__name {
      width: 100%;
      display: flex;
      justify-content: space-between;
      color: var(--colors-text-text-primary, #FAFAFA);
      font-family: Inter;
      font-size: 14px;
      font-style: normal;
      font-weight: 500;
      line-height: 16px;
    }

    .device-item__ip {
      width: 100%;
      display: flex;
      color: var(--colors-text-text-secondary, #B2B6B8);
      font-family: Inter;
      font-size: 14px;
      font-style: normal;
      font-weight: 400;
      line-height: 16px;
      gap: 4px;
      align-items: center;
    }
  }


}
</style>
