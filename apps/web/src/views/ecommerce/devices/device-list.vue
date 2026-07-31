<script setup lang="tsx">
import currency from 'currency.js'
import AdvancedSearch from '/@/views/browser/list/profiles/components/advanced-search.vue'
import RelatedProfilesCell from '/@/views/account/list/components/related-profiles-cell.vue'
import DeviceOutboundCell from './components/device-outbound-cell.vue'
import DeviceExpireCell from './components/device-expire-cell.vue'
import { useDevicePage } from './hooks/useDevicePage'
import ProxyFilter from '/@/views/agent/shop/components/proxy-filter/index.vue'
// import DeviceProviderSimpleList from './components/device-provider-simple-list.vue'
import { ProxyCheckStatus, ProxyExpireStatus, ProxyOrderStatus, ProxyType } from '/@/enums'

const {
  tableRef,
  columns,
  hasFiltered,
  checkedMessage,
  proxyFilter,
  advancedSearchOptions,
  // checkerLoading,
  getTableList,
  getDeviceOperation,
  getDeviceSorts,
  operationHandler,
  createDevice,
  onBuyDevice,
  onAdvancedSearch,
  // testAllDevices,
  tableBeforeRefresh,
  rowClass,
  jumpToWhois,
  openHelp,
  onRenewDevices,
  autoRenewChange,
  toggleRemarkDisplayStatus,
  check,
} = useDevicePage()
</script>

<template>
  <div class="device-list flex flex-col w-full h-full min-h-0">
    <!-- <DeviceProviderSimpleList :on-buy-device="onBuyDevice" /> -->
    <div class="flex flex-1 overflow-hidden min-h-0">
      <RyTable ref="tableRef" v-model:columns="columns" cache-key="ecommerce-device-list" selection-mode="multiple" class="device-list-table flex-1" :table-request="getTableList"
               :table-operation="getDeviceOperation" removable-sort :table-sort="getDeviceSorts" :row-class="rowClass" :operation-handler="operationHandler" :before-refresh="tableBeforeRefresh"
               :virtual-scroller-options="{ itemSize: 60 }"
      >
        <template #filter-after>
          <div class="w-full flex gap-1.5 items-start justify-between">
            <div class="flex items-center gap-2">
              <div class="relative">
                <RxButton size="xxs" icon="base/rx_ic_cart" :label="$t('购买设备')" @click.stop="onBuyDevice()" />
                <div class="new-dot" />
              </div>
              <RxButton v-if="check('Proxy_List_add')" size="xxs" icon="base/rx_ic_plus" variant="outlined" :label="$t('添加设备')" @click.stop="createDevice" />
              <Divider layout="vertical" class="!ml-0 !mr-0 h-4" />
              <ProxyFilter :filter="proxyFilter" :title="$t('筛选设备')" />
            </div>

            <div class="flex items-center gap-2">
              <AdvancedSearch :options="advancedSearchOptions" :search="onAdvancedSearch" :clear="onAdvancedSearch" />
              <Divider layout="vertical" class="!ml-0 !mr-0 h-4" />
              <!-- <RxButton v-if="check('Proxy_List_speed_test')" size="xxs" variant="outlined" severity="secondary" icon="base/rx_ic_speed_test" :label="$t('测试全部设备')" :loading="checkerLoading"
                        @click.stop="testAllDevices()"
              /> -->
              <!-- <Divider layout="vertical" class="!ml-0 !mr-0 h-4" /> -->
            </div>
          </div>
        </template>

        <template #table-empty>
          <CustomEmpty v-if="hasFiltered" icon="rx_illustration_filter.svg" :title="$t('暂无查询结果')" :desc="$t('当前条件下没有匹配的结果，请尝试更换其他筛选条件。')" />
          <CustomNewEmpty v-else icon="base/rx_ic_internet" img="empty-device.png" :title="$t('暂无设备')" :desc="$t('在此购买设备，并更方便地与电商账号进行绑定。')">
            <template #extra>
              <div class="flex gap-3">
                <RxButton outlined severity="secondary" size="xs" icon="base/rx_ic_cart" :label="$t('购买设备')" @click.stop="onBuyDevice()" />
                <RxButton v-if="check('Proxy_List_add')" outlined severity="secondary" size="xs" icon="base/rx_ic_plus" :label="$t('添加设备')" @click.stop="createDevice" />
              </div>
            </template>
          </CustomNewEmpty>
        </template>

        <template #outbound="{ data }">
          <div class="flex items-center gap-2.5">
            <DeviceOutboundCell v-tooltip.top="{ value: data.lastIp && $t('点击查看 IP 地址详情') }" class="cursor-pointer" :country="data.lastCountry" :city="data.lastCity" :last-ip="data.lastIp"
                                :time="data.checkTime" :status="checkedMessage[data.id]" :badge-desc="data.badgeTypeDesc" :is-loading="data.loadingOperationMap?.test" @click.stop="jumpToWhois(data.lastIp)"
            />
            <div
              v-if="data.proxyType === ProxyType.buy && data.checkStatus === ProxyCheckStatus.failure && data.orderStatus === ProxyOrderStatus.done && data.proxyExpireStatus !== ProxyExpireStatus.expired"
              class="flex items-center gap-1.5"
            >
              <SvgIcon name="base/rx_ic_info" color="var(--colors-icon-icon-error)" />
              <RxButton outlined severity="secondary" size="xxs" icon="base/rx_ic_fix" :label="$t('帮助')" @click.stop="openHelp(data)" />
            </div>
          </div>
        </template>

        <template #expireDate="{ data }">
          <DeviceExpireCell :data="data" :show-renew="check('Cost_Center_all')" @renew="() => onRenewDevices([data])" />
        </template>

        <template #price="{ data }">
          <div v-if="data.canRenew">
            <span>{{ currency(data.proxyProviderDiscountPrice).format() }}</span>
            <span class="device-list__days"> / {{ $t('{day} 天', { day: 30 }) }}</span>
          </div>
          <div v-else>
            --
          </div>
        </template>

        <template #renew="{ data }">
          <div v-if="data.canRenew" class="scale-80" @click.stop>
            <RxToggleSwitch v-model="data.autoRenew" :disabled="data.orderStatus !== ProxyOrderStatus.done || data.proxyExpireStatus === ProxyExpireStatus.expired" :true-value="1" :false-value="0"
                            :before-change="() => autoRenewChange(data)"
            />
          </div>
          <div v-else>
            --
          </div>
        </template>

        <template #remarkHeader="{ column: { title, _cache } }">
          <div class="flex items-center gap-2 note-header">
            <span>{{ title }}</span>
            <SvgIcon v-tooltip.top="{ value: _cache.extend ? $t('收起') : $t('展开'), showDelay: 0 }" class="cursor-pointer color-[#989CA0]" :name="_cache.extend ? 'base/rx_ic_hidden' : 'base/rx_ic_eye'"
                     @click.stop="toggleRemarkDisplayStatus(_cache)"
            />
          </div>
        </template>

        <template #remark="{ data, column: { _cache } }">
          <div class="inline-flex items-center gap-1" @click.stop="operationHandler({ name: 'remark' }, data)">
            <RxButton v-tooltip.top="{ value: data.remark, showDelay: 0 }" class="shrink-0" :class="{ 'note-light': data.remark }" text severity="secondary" size="xxs"
                      :icon="data.remark ? 'base/rx_ic_doc_fill' : 'base/rx_ic_doc_add'"
            />
            <div v-if="_cache.extend" :title="data.remark" class="min-w-50 whitespace-pre-wrap note-content">
              {{ data.remark }}
            </div>
          </div>
        </template>

        <template #providerType="{ data }">
          <div v-if="data.proxyType === ProxyType.buy" class="flex items-center gap-2">
            <div class="device-list__tag">
              {{ data.providerType }}
            </div>
          </div>
          <div v-else>
            --
          </div>
        </template>

        <template #bindList="{ data }">
          <RelatedProfilesCell :list="data.bindAccountList" />
        </template>
      </RyTable>
    </div>
  </div>
</template>

<style lang="scss" scoped>
:deep(.device-list-table) {
  tr:not([data-p-selected='true']):hover .row-hover-action,
  tr:not([data-p-selected='true']):focus-within .row-hover-action {
    opacity: 1;
  }

  tr:not([data-p-selected='true']):hover .row-hover-empty,
  tr:not([data-p-selected='true']):focus-within .row-hover-empty {
    display: none;
  }
}

:deep(.row-success) {
  border-color: var(--component-table-border-updated);
  background: var(--colors-background-bg-success);

  & > td {
    border-color: var(--component-table-border-updated);
  }

  .p-datatable-frozen-column {
    background: var(--colors-background-bg-success);
  }
}

.new-dot {
  position: absolute;
  right: 0;
  top: 0;
  transform: translate(40%, -40%);
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: var(--colors-background-bg-error);
}

.device-list__days {
  color: var(--colors-text-text-inactive);
}

.note {
  &-header {
    color: var(--colors-text-text-primary);
    font-size: 12px;
    line-height: 16px;
    font-weight: 600;
  }

  &-content {
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    overflow: hidden;
    text-overflow: ellipsis;
    word-break: break-all;
    line-height: 1.4;
  }

  &-light {
    :deep(svg) {
      color: var(--colors-text-text-brand) !important;
    }
  }
}

.device-list__tag {
  padding: 5px 6px;
  border-radius: 2px;
  border: 1px solid var(--component-tag-border);
  background: var(--component-tag-bg);
  color: var(--colors-text-text-secondary);
  font-family: 'JetBrains Mono';
  font-size: 10px;
  font-weight: 800;
  line-height: 8px;
}
</style>
