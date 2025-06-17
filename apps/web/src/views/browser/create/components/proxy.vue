<script setup lang="ts">
import ProxyCreate from '/@/views/agent/create/quick.vue'
import ProxyTable from '/@/views/agent/list/quick.vue'
import { RxAlert } from '/@/components/rx-alert'
import { RxSvgIcon, type SvgNames } from '/@/components/rx-icon/'
import { useSimpleDialog } from '/@/components/simplePopup'
import { $t } from '/@/locales'
import { useNetworkStore } from '/@/stores/network'
import { deepClone, isEmptyValue, strConcat } from '/@/utils'
import { useCheckProxy } from '/@/views/agent/hooks'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { useDrawer } from '/@/hooks/useDrawer'
import { useTableContext } from '../hooks/useContext'

defineOptions({
  inheritAttrs: false,
})

const [showToast] = useResponseToast()
const network = useNetworkStore()
const drawerInstance = useDrawer()
const { showSimpleDialog } = useSimpleDialog()

const { testProxy: checkProxy, checkResult, batchTestShowToast } = useCheckProxy()
const { isBatch, createCount } = useTableContext()

const attrs = useAttrs()
const proxyList = defineModel<any>('modelValue')

const checkIndex = ref()
const sumProxyCount = computed(() => proxyList.value.reduce((sum: number, item: any) => sum + (item?._proxyCount || 0), 0))
const selectedPorxys = computed(() => proxyList.value.filter((item: any) => item.id))

function onEdit(item: any) {
  if (item.isEncryptProxy) {
    showToast(-1, $t('该代理已加密无法编辑，如需更换，请先删除此代理或选择其他代理'))
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
  const dismissable = type === 'list'
  const title = dismissable ? $t('代理列表') : $t('添加代理')
  const data = dismissable
    ? isBatch.value ? selectedPorxys.value : selectedPorxys.value[0]
    : deepClone(item)
  const RenderComponent = dismissable ? ProxyTable : ProxyCreate

  drawerInstance.showDrawer({
    title,
    dismissable,
    slots: {
      container: () => h(RenderComponent, {
        data,
        isBatch: isBatch.value,
        createCount: createCount.value,
        onClose: () => drawerInstance.hideDrawer(),
        onConfirm: (formData: Record<string, any>) => {
          dismissable ? onChoose(formData) : addProxy(formData)
          drawerInstance.hideDrawer()
        }
      })
    }
  })
}

function deleteProxy(index: number) {
  proxyList.value.splice(index, 1)
}

function addProxy(data: any) {
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
    if (isBatch.value) {
      const addsProxy = proxyList.value.filter((item: any) => !item.id)
      proxyList.value = addsProxy.concat(data).map(({ bindList: _bindList, ...item }: any) => toRaw(item))
    }
    else {
      proxyList.value = [toRaw(data)]
    }
  }
}

async function testProxySpeed(data: any, index: number) {
  checkIndex.value = index
  const result = await checkProxy(toRaw(data))
  batchTestShowToast(result)
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
        }).min(1, $t('数量必须大于{min}', { min: 1 }))
      },
    ],
    onConfirm: (formData: any) => {
      item._proxyCount = Number.parseInt(formData.proxyCount)// 创建时补全代理数量需要用到
    },
  })
}

function tooltipValue(item: any) {
  const value = [
    $t('代理信息'),
    item.ipType,
    `${item.protocol}${strConcat('://', item.host)}${strConcat(':', item.port)}`,
    `${$t('刷新 URL')}: ${item.refreshUrl}`,
    `${$t('位置')}: ${item.lastCountry}${strConcat('/', item.lastCity) || ''}`,
    `${$t('检测时间')}: ${item.checkTime}`,
  ]
  return {
    value: value.join('\n').replace(/(\/|:)?undefined/g, '--'),
    showDelay: 300,
    pt: { root: '!max-w-80' }
  }
}
</script>

<template>
  <div class="w-full flex flex-col gap-3">
    <div class="flex items-center self-stretch gap-2">
      <div class="flex-1 items-center flex gap-2 ">
        <span class="title">{{ attrs.label }}</span>
        <span v-if="!proxyList.length" class="tips">{{ $t('* 不使用代理则默认通过本地直连 ({value})', { value: `${strConcat(network.info?.country_code, strConcat('/', network.info?.city))}` }) }}</span>
      </div>
      <RxButton size="xxs" text severity="secondary" icon="base/rx_ic_exchange" :label="$t('选择')" @click="toggleDrawer('list')" />
      <RxButton v-if="isBatch || !proxyList?.length" size="xxs" text severity="secondary" icon="base/rx_ic_plus" :label="$t('添加')" @click="toggleDrawer('create')" />
    </div>
    <RxAlert v-if="isBatch && sumProxyCount > createCount" class="w-full" type="warn"
      :title="$t('{count} 个窗口将会绑定代理。您创建的窗口数为：{max}。{message}', { count: sumProxyCount, max: createCount, message: $t('当前选择绑定的代理数量已超过创建窗口数。') })" :closable="false"></RxAlert>
    <div class="grid gap-2 list" v-if="proxyList.length">
      <RxCard class="flex gap-2 items-start" v-for="(item, index) in proxyList" :key="index" :closable="false" @click="onEdit(item)">
        <RxSvgIcon class="mt-0.5" :name="(`country-code/${item.lastCountry}` as SvgNames)" fallback="base/rx_ic_earth" color="var(--colors-icon-icon-tertiary)" />
        <div class="flex-1 flex flex-col gap-1">
          <div class="flex items-center gap-2 region">
            <span>{{ item.lastCountry || '--' }}{{ strConcat('/', item.lastCity) }}</span>
            <RxSvgIcon v-tooltip.top="tooltipValue(item)" name="base/rx_ic_info_fill" size="12" color="var(--colors-icon-icon-note)" />
          </div>
          <div class="flex items-center gap-1.5 info" v-if="isBatch">
            <span>{{ $t('绑定窗口数:') }}</span>
            <span class="text-[var(--colors-text-text-primary)] font-bold">{{ item._proxyCount }}</span>
            <span class="text-[var(--colors-text-text-link)] cursor-pointer" @click.stop="modifyProxyCount(item)">{{ $t('修改') }}</span>
          </div>
          <div class="flex items-center gap-1.5 info" v-else>
            <span>{{ item.ipType }}</span>
            <span class="line"></span>
            <span>{{ item.proxyCategory || item.protocol }}{{ strConcat('://', item.host) }}{{ strConcat(':', item.port) }}</span>
          </div>
        </div>
        <div class="mt-0.5 flex gap-2">
          <RxSvgIcon class="cursor-pointer" :class="{ 'pi-spin': checkIndex === index && checkResult.loading }"
            :name="(checkIndex === index && checkResult.loading) ? 'base/rx_ic_progress_bar' : 'base/rx_ic_speed_test'" color="var(--colors-icon-icon-tertiary)"
            @click.stop="testProxySpeed(item, index)" />
          <RxSvgIcon class="cursor-pointer" name="base/rx_ic_delete" color="var(--colors-icon-icon-tertiary)" @click.stop="deleteProxy(index)" />
        </div>
      </RxCard>
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
</style>
