<script setup lang="tsx">
import type { UserGetLoginInfoListData } from '@roxy/backend-api';
import { RxSvgIcon } from '/@/components/rx-icon'
import { useDialog } from '/@/hooks/useDialog'
import RxInputText from '/@/components/ry-form/rx-input-text.vue'
import { $t } from '/@/locales'
import Message from 'primevue/message';
import { API } from "/@/api";
import { useResponseToast } from "/@/hooks/useResponseToast";

const props = defineProps<{
  devices: UserGetLoginInfoListData['data']
  isEdit?: boolean
}>()

const emit = defineEmits<{
  (e: 'change', value: string): void
}>()
const [showModal] = useDialog()
const [, onlyErrorToast] = useResponseToast();
const editDeviceInfo = reactive({
  deviceName: '',
  deviceId: '',
  isError: false
})

const deviceIconMap = {
  win: 'platforms/rx_os_windows',
  mac: 'platforms/rx_os_macOS',
  linux: 'platforms/rx_os_linux',
  ios: 'platforms/rx_os_iOS',
  android: 'platforms/rx_os_android',
} as const

const deviceList = computed(() => {
  return props.devices.map((item) => {
    return {
      ...item,
      deviceName: decodeURIComponent(item.deviceName || ''),
    }
  })
})

const handleEdit = (deviceName: string, deviceId: string) => {
  editDeviceInfo.deviceName = deviceName;
  editDeviceInfo.deviceId = deviceId;
  handleBlur()
  showModal({
    header: $t('编辑设备名称'),
    okText: $t('确认'),
    style: {
      width: '480px',
    },
    slots: {
      default: () => <div class="flex flex-col gap-3">
        <div>
          {$t('当前设备将显示以下名称：')}
        </div>
        <RxInputText modelValue={editDeviceInfo.deviceName} onBlur={handleBlur} onUpdate:modelValue={(val: string) => editDeviceInfo.deviceName = val} />
        {editDeviceInfo.isError ? <Message severity="error" size="small" variant="simple">{$t('设备名称最多支持 30 个字符')}</Message> : <></>}
      </div>,
    },
    handleOk: async () => {
      console.log('editDeviceInfo', editDeviceInfo)
      handleBlur();
      if (editDeviceInfo.isError) {
        throw new Error('报错阻止关闭弹窗')
      }

      if (editDeviceInfo.deviceName !== deviceName) {
        const result = await API.base.userUpdateDeviceNameCreate({
          deviceName: editDeviceInfo.deviceName,
          deviceMac: editDeviceInfo.deviceId,
        })
        onlyErrorToast(result.code, result.msg)
        if (result.code === 0) {
          emit('change', editDeviceInfo.deviceName)
        }
      }
    }
  })
}

watch(editDeviceInfo, (newVal) => {
  console.log(newVal)
})

const handleBlur = () => {
  editDeviceInfo.isError = editDeviceInfo.deviceName.length > 30;
}
</script>

<template>
  <template v-for="item in deviceList" :key="item.id">
    <div class="device-item" :class="{ line: devices.length > 1 }">
      <div class="device-item__icon">
        <RxSvgIcon :name="deviceIconMap[item.platform as keyof typeof deviceIconMap] || 'base/rx_ic_browsers_fill'" size="24px" />
      </div>
      <div class="device-item__info">
        <div class="device-item__name">
          <span class="text-[color:--colors-text-text-primary] flex items-center gap-2">
            <span class="max-w-220px ellipsis-1" v-tooltip.top="{ value: item.deviceName }">{{ item.deviceName }}</span>
            <RxSvgIcon name="base/rx_ic_edit" size="16px" class="cursor-pointer" v-if="isEdit" @click="handleEdit(item.deviceName, item.deviceId!)" />
          </span>
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
    border-bottom: 1px solid var(--colors-border-divider, #C7CDD1);

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
    border: 1px solid var(--colors-border-border-base, #C7CDD1);
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
