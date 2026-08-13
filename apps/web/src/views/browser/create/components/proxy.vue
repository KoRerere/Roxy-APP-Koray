<script setup lang="ts">
import { h } from 'vue'
import ProxyQuick from '/@/views/agent/quick.vue'
import ProxyBuyAddDrawer from './proxy-buy-add-drawer.vue'
import ProxyCountrySwitch from '/@/views/browser/create/components/proxy-country-switch.vue'
import { RxAlert } from '/@/components/rx-alert'
// import currency from 'currency.js'
import { useSimpleDialog } from '/@/components/simplePopup'
import { deepClone, isEmptyValue, strConcat } from '/@/utils'
import { useCheckProxy } from '/@/views/agent/hooks'
import { useProxyFormDrawer } from '/@/views/agent/hooks/useProxyFormDrawer'
import { createProxyCreateLabels } from '/@/views/agent/create/proxy-create-mode'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { useDrawer } from '/@/hooks/useDrawer'
import { usePermission } from '/@/hooks/usePermission'
import { useTableContext } from '../hooks/useContext'
import { useNetworkStore } from '/@/stores/network'
import { useProxyStore } from '/@/stores/proxy'
import { useDialog } from '/@/hooks/useDialog'
import { API } from '/@/api'
import { BuyProxyListType, ProxyType } from '/@/enums/proxy'
import type { SvgNames } from '/@/components/rx-icon/'

defineOptions({
  inheritAttrs: false,
})
const { isBatch, createCount, presetTemplate } = useTableContext()

const router = useRouter()
const drawerInstance = useDrawer()
const { showProxyFormDrawer } = useProxyFormDrawer(drawerInstance)
const proxyCreateLabels = createProxyCreateLabels('proxy')
const network = useNetworkStore()
const { testProxy: checkProxy, batchTestShowToast } = useCheckProxy()
const { getProxyVendors } = useProxyStore()
const { showSimpleDialog } = useSimpleDialog()
const { check } = usePermission()
const [showToast, _] = useResponseToast()
const [showModal] = useDialog()

const attrs = useAttrs()
const proxyList = defineModel<any>('modelValue')

const checkIndex = reactive<Record<string, boolean>>({})
const sumProxyCount = computed(() => proxyList.value.reduce((sum: number, item: any) => sum + (item?._proxyCount || 0), 0))
const selectedPorxys = computed(() => proxyList.value.filter((item: any) => item.id))

const proxyProvider = ref()
const dualDrawerVisible = ref(false)
const moreCountryDrawerVisible = ref(false)

const proxyAlertMessage = computed(() => {
  return sumProxyCount.value > createCount.value
    ? $t('仅 {count} 个窗口将会绑定代理 IP。请移除多余的 {beyond} 条代理 IP。', {
        count: createCount.value,
        beyond: sumProxyCount.value - createCount.value,
      })
    : $t('仅 {count} 个窗口将会绑定代理 IP', { count: sumProxyCount.value })
})

const canBuy = computed(() => check('Cost_Center_all'))
const canAdd = computed(() => (isBatch.value || !proxyList.value?.length) && !moreCountryDrawerVisible.value && check('Profiles_add_proxy_outside'))

const providerProps = computed(() => {
  if (!proxyProvider.value)
    return undefined

  return {
    proxyProviderId: proxyProvider.value.id,
    proxyProviderWebsite: proxyProvider.value.vendorWebsite,
    proxyProviderIcon: proxyProvider.value.vendorIcon,
    proxyProviderName: proxyProvider.value.vendorName,
  }
})

async function openDualDrawer() {
  if (canBuy.value && !proxyProvider.value) {
    const data = await getProxyVendors()
    if (!data)
      return
    proxyProvider.value = data.find((item: any) => item.isOfficial)
  }

  dualDrawerVisible.value = true
}

function closeDualDrawer() {
  dualDrawerVisible.value = false
}

async function onDualDrawerBuySuccess(orderInfo: any) {
  try {
    await buySuccessNext(orderInfo)
  }
  finally {
    closeDualDrawer()
  }
}

function onDualDrawerAddConfirm(formData: Record<string, any>) {
  addProxy(formData)
  closeDualDrawer()
}

async function buySuccessNext(orderInfo: any) {
  if (!orderInfo?.immediate) {
    router.push({ name: 'agent-list', query: { name: 'shop', orderNo: orderInfo?.orderNo } })
    return
  }

  const { code, data } = await API.proxy.userGetUserBuyProxyListList({ orderNo: orderInfo?.orderNo, type: BuyProxyListType.Use } as any)
  if (code !== 0 || !data.rows?.[0]) {
    router.push({ name: 'agent-list', query: { name: 'shop', orderNo: orderInfo?.orderNo } })
    return
  }

  if (isBatch.value) {
    data.rows.forEach((item) => {
      const _data = { ...item, _type: ProxyType.buy }
      addProxy(_data)
    })
  }
  else {
    onChoose(data.rows[0])
  }
}

function onEdit(item: any) {
  if (!check('Profiles_edit_proxy_outside')) {
    return
  }

  if (item.isEncryptProxy) {
    showToast(-1, $t('该代理 IP 已加密无法编辑，如需更换，请先删除此代理 IP 或选择其他代理 IP'))
    return
  }
  if (item.id) {
    toggleDrawer('list')
  }
  else {
    toggleDrawer('create', item)
  }
}

function toggleDrawer(type: 'create' | 'list', item?: any) {
  if (type === 'create') {
    showProxyFormDrawer({
      title: proxyCreateLabels.pageTitle,
      data: deepClone(item),
      mode: 'proxy',
      onConfirm: (formData) => {
        addProxy(formData)
      },
    })
    return
  }

  const data = isBatch.value ? selectedPorxys.value : selectedPorxys.value[0]
  drawerInstance.showDrawer({
    title: $t('代理 IP 列表'),
    slots: {
      container: () => h(ProxyQuick, {
        data,
        isBatch: isBatch.value,
        createCount: createCount.value,
        onClose: () => drawerInstance.hideDrawer(),
        onConfirm: (formData: Record<string, any>) => {
          onChoose(formData)
          drawerInstance.hideDrawer()
        },
      }),
    },
  })
}

function deleteProxy(index: number) {
  proxyList.value.splice(index, 1)
}

function addProxy(data: any) {
  clearPresetTemplate()
  if (data._tempId) {
    const index = proxyList.value.findIndex((item: any) => item._tempId === data._tempId)
    if (index > -1) {
      const old = proxyList.value[index]
      Reflect.set(proxyList.value, index, { ...old, ...data })
    }
    return
  }

  if (!data.id) {
    data._tempId = Date.now().toString(32)
  }

  if (isBatch.value) {
    proxyList.value.push({ ...data, _proxyCount: 1 })
  }
  else {
    proxyList.value = [data]
  }
}

function onChoose(data: any) {
  if (!isEmptyValue(data)) {
    clearPresetTemplate()
    if (isBatch.value) {
      /**
       *过滤手动新增的代理
       */
      const addsProxy = proxyList.value.filter((item: any) => !item.id)
      proxyList.value = addsProxy.concat(data).map(({ bindList: _bindList, ...item }: any) => toRaw(item))
    }
    else {
      proxyList.value = [toRaw(data)]
    }
  }
}

async function testProxySpeed({ _checkRes, bindList: _bindList, ...data }: any, index: number) {
  checkIndex[index] = true
  const result = await checkProxy({ ...toRaw(data), apiCheck: false })
  checkIndex[index] = false
  batchTestShowToast({ ...result, proxyType: data.proxyType ?? data.buyProxyType }, { reCheck: () => testProxySpeed(data, index) })
  Object.assign(data, result)
}

function modifyProxyCount(item: any) {
  showSimpleDialog({
    content: $t('设置绑定的窗口数量'),
    inputs: [
      {
        type: 'number',
        name: 'proxyCount',
        value: item._proxyCount,
        props: {
          placeholder: $t('请输入数量'),
        },
        resolver: (z: any) => z.number({
          invalid_type_error: $t('数量必须大于{min}', { min: 1 }),
        }).min(1, $t('数量必须大于{min}', { min: 1 })),
      },
    ],
    onConfirm: (formData: any) => {
      item._proxyCount = Number.parseInt(formData.proxyCount)// 创建时补全代理数量需要用到
    },
  })
}

function tooltipValue(item: any) {
  const value = [
    $t('代理 IP 信息'),
    item.ipType,
    `${item.protocol}${strConcat('://', item.host)}${strConcat(':', item.port)}`,
    `${$t('刷新 URL')}: ${item.refreshUrl}`,
    `${$t('位置')}: ${item.lastCountry}${strConcat('/', item.lastCity) || ''}`,
    `${$t('检测时间')}: ${item.checkTime}`,
  ]
  return {
    value: value.join('\n').replace(/(\/|:)?undefined/g, '--'),
    showDelay: 300,
    pt: { root: '!max-w-80' },
  }
}

function clearPresetTemplate() {
  if (presetTemplate) {
    presetTemplate.value = undefined
  }
}

function switchProxyCountry() {
  showModal({
    showHeader: false,
    modal: true,
    blockScroll: true,
    slots: {
      container: ({ hideModal }) => h(ProxyCountrySwitch, {
        data: presetTemplate!.value.proxyInfo,
        onClose: hideModal,
        onConfirm: (data: any) => {
          hideModal()
          Reflect.set(presetTemplate!.value, 'proxyInfo', data)
        },
        onMore: () => {
          hideModal()
          moreCountryDrawerVisible.value = true
          openDualDrawer()
        },
      }),
    },
  })
}
</script>

<template>
  <div class="w-full flex flex-col gap-3">
    <div class="flex items-center self-stretch gap-2">
      <div class="flex-1 flex flex-col gap-1.5 ">
        <div class="title">
          {{ attrs.label }}
        </div>
        <div v-if="!presetTemplate && !proxyList.length" class="flex items-center gap-1 tips">
          <span>{{ $t('本机网络环境: {value}({ip})', {
            value: strConcat(network.info?.country_code, strConcat('/', network.info?.city)),
            ip: network.info?.ip,
          }) }}</span>
          <SvgIcon v-tooltip.top="{ value: $t('无代理 IP 的情况下该窗口将使用当前 IP 作为出口 IP') }" name="base/rx_ic_info" size="14" color="var(--colors-icon-icon-note)" />
        </div>
      </div>

      <div v-if="canBuy || canAdd" class="flex items-center gap-2">
        <RxButton size="xxs" text severity="secondary" icon="base/rx_ic_cart" :label="proxyList.length && !isBatch ? $t('购买') : $t('购买 / 添加')" @click="openDualDrawer" />
      </div>
      <RxButton v-if="check('Profiles_select_proxy')" size="xxs" text severity="secondary" icon="base/rx_ic_exchange" :label="$t('选择')" @click="toggleDrawer('list')" />
    </div>
    <ProxyBuyAddDrawer v-model:visible="dualDrawerVisible" :show-buy="canBuy" :show-add="canAdd" :provider="providerProps" @close="moreCountryDrawerVisible = false" @buy-success="onDualDrawerBuySuccess"
                       @add-confirm="onDualDrawerAddConfirm"
    />
    <div class="pl-27 flex flex-col gap-3 empty:hidden">
      <RxAlert v-if="isBatch && sumProxyCount && sumProxyCount !== createCount" class="w-full whitespace-pre-line" :type="sumProxyCount > createCount ? 'warn' : 'info'" :closable="false"
               :title="proxyAlertMessage"
      />
      <div v-if="!presetTemplate && proxyList.length" class="grid gap-2 list">
        <RxCard v-for="(item, index) in proxyList" :key="index" class="flex gap-2 items-start overflow-hidden" :closable="false" @click="onEdit(item)">
          <SvgIcon class="mt-0.5" :name="(`country-code/${item.lastCountry}` as SvgNames)" fallback="base/rx_ic_earth" color="var(--colors-icon-icon-tertiary)" />
          <div class="flex-1 flex flex-col gap-1 overflow-hidden">
            <div class="flex items-center gap-2 region">
              <span>{{ item.lastCountry || '--' }}{{ strConcat('/', item.lastCity) }}</span>
              <SvgIcon v-tooltip.top="tooltipValue(item)" name="base/rx_ic_info_fill" size="12" color="var(--colors-icon-icon-note)" />
            </div>
            <div v-if="isBatch" class="flex items-center gap-1.5 info">
              <span>{{ $t('绑定窗口数:') }}</span>
              <span class="text-[var(--colors-text-text-primary)] font-bold">{{ item._proxyCount }}</span>
              <span class="text-[var(--colors-text-text-link)] cursor-pointer" @click.stop="modifyProxyCount(item)">{{
                $t('修改') }}</span>
            </div>
            <div v-else class="flex items-center gap-1.5 info">
              <div>{{ item.ipType }}</div>
              <div class="line" />
              <div class="flex-1 ellipsis-1">
                {{ item.proxyCategory || item.protocol }}{{ strConcat('://', item.host) }}{{
                  strConcat(':', item.port) }}
              </div>
            </div>
          </div>
          <div class="mt-0.5 flex gap-2">
            <SvgIcon v-if="check('Profiles_speed_test_proxy')" class="cursor-pointer" :class="{ 'pi-spin': checkIndex[index] }"
                     :name="checkIndex[index] ? 'base/rx_ic_progress_bar' : 'base/rx_ic_speed_test'" color="var(--colors-icon-icon-tertiary)" @click.stop="testProxySpeed(item, Number(index))"
            />
            <SvgIcon v-if="check('Profiles_delete_proxy_outside')" class="cursor-pointer" name="base/rx_ic_delete" color="var(--colors-icon-icon-tertiary)" @click.stop="deleteProxy(Number(index))" />
          </div>
        </RxCard>
      </div>
      <div v-if="presetTemplate && !isBatch" class="flex items-center gap-2">
        <div class="flex-1 flex flex-col gap-1 pa-2 rounded-1.5 cursor-pointer preorder" @click="switchProxyCountry">
          <div class="flex items-center gap-2">
            <SvgIcon :name="(`country-code/${presetTemplate.proxyInfo.purchaseCountry.value.toLocaleUpperCase()}` as any)" size="20" />
            <div class="flex items-center gap-2">
              <span class="tt-primary text-3 font-500 leading-5">{{ presetTemplate.proxyInfo.purchaseCountry.label }}</span>
              <SvgIcon class="cursor-pointer" name="base/rx_ic_exchange" size="14" color="var(--colors-icon-icon-tertiary)" />
            </div>
            <SvgIcon class="mx-auto mr-0 cursor-pointer" name="base/rx_ic_delete" color="var(--colors-icon-icon-tertiary)" @click.stop="clearPresetTemplate" />
          </div>
          <div class="flex items-center gap-1.5 pl-7">
            <div class="select-none preorder-desc">
              {{ presetTemplate.description }}
            </div>
            <SvgIcon v-tooltip.top="{ value: presetTemplate.hover, showDelay: 300 }" class="cursor-pointer" name="base/rx_ic_info" size="12" color="var(--colors-icon-icon-note)" />
          </div>
        </div>
        <div class="flex-1 tt-inactive text-3 leading-4">
          {{ $t('Roxy 官方直营 IP，业务稳定性 99%+') }}
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.title {
  color: var(--colors-text-text-primary);
  font-size: 16px;
  font-weight: 600;
  line-height: 16px;
}

.tips {
  color: var(--colors-text-text-tertiary);
  font-size: 12px;
  line-height: 16px;
}

.list {
  grid-template-columns: repeat(2, 1fr);
}

.line {
  width: 1px;
  height: 12px;
  background: var(--component-dropdown-divider);
}

.region {
  color: var(--colors-text-text-primary);
  font-size: 12px;
  font-weight: 500;
  line-height: 20px;
}

.info {
  color: var(--colors-text-text-tertiary);
  font-size: 12px;
  line-height: 16px;
}

.preorder {
  border: 1px solid var(--colors-border-border-action);
  background-color: var(--colors-background-bg-action);
  box-shadow: 0 1px 2px 0 rgba(16, 24, 40, 0.05);

  background-image: url('/images/proxy/preorder_bg_line.svg');
  background-size: 100% auto;
  background-repeat: no-repeat;
  background-position: top center;

  &-desc {
    font-family: 'DingTalk JinBuTi';
    font-size: 12px;
    line-height: 16px;
    background: linear-gradient(90deg, #1ba9ff 0%, #60d990 100%);
    background-clip: text;
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }
}
</style>
