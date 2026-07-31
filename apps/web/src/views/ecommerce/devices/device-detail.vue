<script setup lang="ts">
import DeviceBindList from '/@/views/ecommerce/devices/components/device-bind-list.vue'
import DeviceLog from '/@/views/ecommerce/devices/components/device-log.vue'
import { SimpleCopy } from '/@/components/rx-copy'
import { API } from '/@/api'
import { getImage, strConcat } from '/@/utils/basic'
import { ProxyExpireStatus, ProxyOrderStatus, ProxyType } from '/@/enums'
import { differenceInDays } from 'date-fns'
import { useThemeStore } from '/@/stores/theme'
import type { DeviceItem } from './device-operation'
import type { UserGetProxyDeviceDetailListData } from '@roxy/backend-api'

type DeviceDetail = UserGetProxyDeviceDetailListData['data']

const { data } = defineProps<{
  data: DeviceItem
}>()

defineEmits(['close'])

const { isDarkTheme } = storeToRefs(useThemeStore())

const detail = ref<DeviceDetail>()

async function fetchDeviceDetail() {
  const res = await API.proxy.userGetProxyDeviceDetailList({ id: String(data.id) })
  if (res.code === 0)
    detail.value = res.data
}

onMounted(fetchDeviceDetail)

const ExpireStatusMap = {
  [ProxyExpireStatus.expired]: { text: $t('已过期'), color: 'var(--colors-text-text-inactive)' },
  [ProxyExpireStatus.using]: { text: $t('使用中'), color: 'var(--colors-text-text-success)' },
  [ProxyExpireStatus.soon]: { text: $t('即将过期'), color: 'var(--colors-text-text-warning)' },
} as const

const OrderStatusMap = {
  [ProxyOrderStatus.pending]: { text: $t('配置中, 预计 {time} 分钟内完成', { time: 2 }), color: 'var(--colors-text-text-primary)' },
  [ProxyOrderStatus.refunding]: { text: $t('退款中, 预计 {time} 小时内完成', { time: 12 }), color: 'var(--colors-text-text-inactive)' },
  [ProxyOrderStatus.changing]: { text: $t('更换中, 预计 {time} 小时内完成', { time: 12 }), color: 'var(--colors-text-text-inactive)' },
  [ProxyOrderStatus.refunded]: { text: $t('已退款'), color: 'var(--colors-text-text-inactive)' },
} as const

/** 详情卡片展示字段，与列表页到期单元格状态逻辑保持一致 */
const display = computed(() => {
  const source = detail.value
  if (!source) {
    return {
      statusText: '--',
      statusColor: 'var(--colors-text-text-tertiary)',
      title: '--',
      subtitle: '--',
      remainingDays: null,
      expireDate: '--',
      lastIp: '',
      bindAccountCount: 0,
      bindIcons: [],
      deviceInfoText: '--',
    }
  }

  const status = OrderStatusMap[source.orderStatus as keyof typeof OrderStatusMap]
    || ExpireStatusMap[source.proxyExpireStatus as keyof typeof ExpireStatusMap]
    || { text: '--', color: 'var(--colors-text-text-tertiary)' }

  const title = source.proxyType === ProxyType.buy
    ? (source.proxyProviderName || $t('官方赠送'))
    : (source.host || source.proxyProviderName || '--')

  const subtitle = (`${source.lastCountry || ''}${strConcat('/', source.lastCity)}` || '--')

  const remainingDays = source.expireDate
    ? Math.max(differenceInDays(new Date(source.expireDate), new Date()), 0)
    : null

  const deviceInfoText = [source.host, source.port, source.proxyUserName, source.proxyPassword].filter(Boolean).join(':')

  return {
    statusText: status.text,
    statusColor: status.color,
    title,
    subtitle,
    remainingDays,
    expireDate: source.expireDate || '--',
    lastIp: source.lastIp || '',
    bindAccountCount: source.relatedAccountCount,
    bindIcons: source.relatedPlatformIcons.slice(0, 2).map(item => isDarkTheme.value ? item.platformIconDark : item.platformIcon),
    deviceInfoText: deviceInfoText || '--',
  }
})

const tabs = ref([
  {
    title: $t('已绑定账号'),
    value: 'installed',
    slot: 'installed',
  },
  {
    title: $t('设备操作日志'),
    value: 'hub',
    slot: 'hub',
  },
])

const tabsValue = ref(tabs.value[0].value)
</script>

<template>
  <div class="flex flex-col pa-6 pt-4 gap-4 w-192">
    <div class="h-9 flex items-center justify-between">
      <div class="tt-primary text-4 font-600 leading-normal">
        {{ $t('设备详情') }}
      </div>
      <SvgIcon class="cursor-pointer" name="base/rx_ic_delete" size="20" color="var(--colors-icon-icon-secondary)" @click="$emit('close')" />
    </div>
    <div class="rounded-3 overflow-hidden card">
      <div class="h-40 flex items-center py-6 px-7 gap-4 rounded-3 card-summary" :class="{ '!border-none': detail?.proxyType !== ProxyType.resource }">
        <div class="flex-1 flex items-center gap-6">
          <img class="block w-20 h-20" :src="getImage('ecommerce/device.png')">
          <div class="flex items-center gap-10">
            <div class="flex flex-col gap-1.5">
              <div class="font-600 text-3 leading-4" :style="{ color: display.statusColor }">
                {{ display.statusText }}
              </div>
              <div class="tt-primary font-700 text-5 leading-7">
                {{ display.title }}
              </div>
              <div class="tt-tertiary text-3 leading-4">
                {{ display.subtitle }}
              </div>
            </div>
            <div class="flex flex-col gap-1.5">
              <div class="tt-tertiary text-3 leading-4">
                {{ $t('剩余可用天数') }}
              </div>
              <div v-if="detail?.isPermanent" class="tt-brand font-600 text-6 leading-7">
                {{ $t('永久') }}
              </div>
              <template v-else>
                <div class="flex items-baseline gap-1">
                  <span class="tt-brand font-600 text-6 leading-7">{{ display.remainingDays ?? '--' }}</span>
                  <span class="tt-tertiary text-3 leading-4">{{ $t('天') }}</span>
                </div>
                <div class="tt-tertiary text-3 leading-4">
                  {{ $t('到期时间：{date}', { date: display.expireDate }) }}
                </div>
              </template>
            </div>
          </div>
        </div>
        <RxDivider vertical line-only />
        <div class="w-50 h-full flex flex-col gap-3">
          <div class="flex-1 flex flex-col justify-center gap-1.5">
            <div class="tt-tertiary text-3 leading-4">
              {{ $t('设备出口：') }}
            </div>
            <SimpleCopy v-if="display.lastIp" class="gap-1.5 tt-primary text-3.25 leading-4.5" :text="display.lastIp" />
            <div v-else class="text-3.25">
              --
            </div>
          </div>
          <RxDivider line-only />
          <div class="flex-1 flex flex-col justify-center gap-1.5">
            <div class=" tt-tertiary text-3 leading-4">
              {{ $t('已关联账号：') }}
            </div>
            <div class="flex items-center gap-2">
              <img v-for="src in display.bindIcons" :key="src" class="block w-4" :src="src">
              <div class="tt-primary text-3.25 leading-4.5">
                {{ $t('等 {count} 个账号', { count: display.bindAccountCount }) }}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div v-if="detail?.proxyType === ProxyType.resource" class="flex items-center py-3 px-5 gap-2">
        <div class="tt-placeholder text-3.25 leading-4.5">
          {{ $t('设备信息') }}:
        </div>
        <SimpleCopy class="gap-2 tt-primary text-3.25 leading-4.5" :text="display.deviceInfoText" />
      </div>
    </div>

    <RxTabs v-model:value="tabsValue" class="h-80 gap-3" :tabs="tabs" head-tabs>
      <template #installed>
        <DeviceBindList :data="data" />
      </template>
      <template #hub>
        <DeviceLog :data="data" />
      </template>
    </RxTabs>
  </div>
</template>

<style lang="scss" scoped>
.card {
  border: 1px solid var(--colors-border-border-inactive);

  &-summary {
    background: linear-gradient(
      111deg,
      var(--colors-background-bg-app, #f5fbff) -8.58%,
      var(--colors-background-bg-block, #f1f5f8) 52.04%
    );
    border-bottom: 1px solid var(--colors-border-border-inactive);
  }
}
</style>
