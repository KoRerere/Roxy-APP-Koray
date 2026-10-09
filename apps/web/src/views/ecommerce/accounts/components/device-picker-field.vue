<script setup lang="ts">
import { h } from 'vue'
import BindDevice from '/@/views/ecommerce/accounts/components/bind-device.vue'
import { buildDeviceInfoFromProxy, isPresentBusinessId } from '/@/views/ecommerce/accounts/ecommerce-window-mode'
import type { EcommerceDeviceInfo } from '/@/views/ecommerce/accounts/ecommerce-window-mode'
import DeviceSelectList from '/@/views/ecommerce/devices/device-select-list.vue'
import { useDrawer } from '/@/hooks/useDrawer'
import { usePermission } from '/@/hooks/usePermission'

defineOptions({ inheritAttrs: false })

const {
  modelValue,
  deviceInfo = null,
  placeholder = $t('请选择绑定设备'),
} = defineProps<{
  modelValue?: string | number
  deviceInfo?: EcommerceDeviceInfo | null
  placeholder?: string
}>()

const emit = defineEmits<{
  update: [value: string | number]
  change: [value: { moduleId: string | number, deviceInfo: EcommerceDeviceInfo | null }]
}>()

const { check } = usePermission()
const drawerInstance = useDrawer()

const canSelect = computed(() => check('Profiles_select_proxy'))
const hasSelection = computed(() => isPresentBusinessId(modelValue) && deviceInfo)

function buildDrawerData() {
  if (!isPresentBusinessId(modelValue))
    return undefined

  return {
    id: modelValue,
    lastCountry: deviceInfo?.lastCountry,
    lastCity: deviceInfo?.lastCity,
    lastIp: deviceInfo?.lastIp,
    port: deviceInfo?.port,
  }
}

function emitDeviceChange(moduleId: string | number, deviceInfo: EcommerceDeviceInfo | null) {
  emit('update', moduleId)
  emit('change', { moduleId, deviceInfo })
}

function openSelectDrawer() {
  if (!canSelect.value)
    return

  drawerInstance.showDrawer({
    title: $t('设备列表'),
    dismissable: true,
    closeOnEscape: false,
    slots: {
      container: () => h(DeviceSelectList, {
        data: buildDrawerData(),
        onConfirm: (proxy: Record<string, any>) => {
          emitDeviceChange(proxy.id ?? '', buildDeviceInfoFromProxy(proxy))
          drawerInstance.hideDrawer()
        },
      }),
    },
  })
}

function clearSelection(event: Event) {
  event.stopPropagation()
  emitDeviceChange('', null)
}
</script>

<template>
  <div class="device-picker" :class="{ 'device-picker--disabled': !canSelect, 'device-picker--selected': hasSelection }" v-tooltip.top="!canSelect ? $t('暂无权限') : ''" @click="openSelectDrawer">
    <template v-if="hasSelection && deviceInfo">
      <BindDevice class="flex-1 min-w-0 text-3" :data="deviceInfo" />
      <SvgIcon class="device-picker__clear shrink-0 cursor-pointer" name="base/rx_ic_delete" color="var(--colors-icon-icon-secondary)" @click="clearSelection" />
    </template>
    <template v-else>
      <span class="device-picker__placeholder">{{ placeholder }}</span>
      <SvgIcon class="shrink-0" name="base/rx_ic_exchange" color="var(--colors-icon-icon-tertiary)" />
    </template>
  </div>
</template>

<style lang="scss" scoped>
.device-picker {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 32px;
  padding: 6px 10px;
  border-radius: var(--Component-Colors-TextInput-radius-radius-md, 6px);
  border: 1px solid var(--colors-border-border-base, #c7cdd1);
  background: var(--colors-background-bg-action, #fff);
  cursor: pointer;
  transition: border-color 0.2s;

  &:hover:not(&--disabled) {
    border-color: var(--colors-border-border-action, #12a3fc);
  }

  &--disabled {
    cursor: not-allowed;
    opacity: 0.6;
  }

  &--selected {
    align-items: flex-start;
    padding: 8px 10px;
  }

  &__placeholder {
    flex: 1;
    color: var(--colors-text-text-placeholder, #8b9498);
    opacity: 0.6;
    font-size: 12px;
    line-height: 20px;
  }

  &__clear {
    margin-top: 2px;
  }
}
</style>
