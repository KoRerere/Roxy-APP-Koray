<script setup lang="ts">
import ProxyCreate from '/@/views/agent/create/quick.vue'
import ProxyTable from '/@/views/agent/list/quick.vue'
import RxInputRadio from '/@/components/ry-form/rx-input-radio.vue'
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

const proxyList = defineModel<any>('modelValue')
const proxySwitch = defineModel('proxySwitch', { default: false })

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

async function testProxy(data: any, index: number) {
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
    showDelay: 500,
    pt: { root: '!max-w-80' }
  }
}

</script>

<template>
  <div class="w-full">
    <div class="proxy-switch">
      <RxInputRadio v-model="proxySwitch" size="xs" name="proxySwitch" :options="[{ label: $t('直连'), value: false }, { label: $t('使用代理'), value: true }]" />
    </div>
    <div v-if="!proxySwitch" class="direct">
      {{ $t('* 不使用代理则默认通过本地直连 ({value})', {
        value: `${strConcat(network.info?.country_code, strConcat('/', network.info?.city))}`
      }) }}
    </div>
    <template v-else>
      <div class="button-group">
        <RxButton size="xxs" outlined severity="secondary" icon="base/rx_ic_exchange" :label="$t('选择')" @click="toggleDrawer('list')" />
        <RxButton v-if="isBatch || !proxyList?.length" size="xxs" outlined severity="secondary" icon="base/rx_ic_plus" :label="$t('添加')" @click="toggleDrawer('create')" />
      </div>
      <div>
        <template v-if="isBatch">
          <RxAlert v-if="sumProxyCount > createCount" class="w-full multiple" type="warn"
            :title="$t('{count} 个窗口将会绑定代理。您创建的窗口数为：{max}。{message}', { count: sumProxyCount, max: createCount, message: $t('当前选择绑定的代理数量已超过创建窗口数。') })" :closable="false" />
          <RxCard class="multiple" v-for="(item, index) in proxyList" :key="index" @click="onEdit(item)" @close="deleteProxy(index)">
            <div class="multiple-region">
              <RxSvgIcon class="single-img" :name="(`country-code/${item.lastCountry}` as SvgNames)" fallback="base/rx_ic_earth" />
              <span>{{ item.lastCountry || '--' }}{{ strConcat('/', item.lastCity) }}</span>
              <RxSvgIcon v-tooltip.top="tooltipValue(item)" name="base/rx_ic_info_fill" :size="12" />
            </div>
            <RxTag class="cursor-pointer" icon="base/rx_ic_browser" :label="item._proxyCount" @click.stop="modifyProxyCount(item)" />
            <RxSvgIcon class="cursor-pointer" :class="{ 'pi-spin': checkIndex === index && checkResult.loading }"
              :name="(checkIndex === index && checkResult.loading) ? 'base/rx_ic_progress_bar' : 'base/rx_ic_speed_test'" @click.stop="testProxy(item, index)" />
          </RxCard>
        </template>

        <template v-else>
          <RxCard v-for="(item, index) in proxyList" :key="index" class="single" @click="onEdit(item)" @close="deleteProxy(index)">
            <RxSvgIcon class="single-img" :name="(`country-code/${item.lastCountry}` as SvgNames)" fallback="base/rx_ic_earth" />
            <div class="flex justify-between single-region ">
              <span>{{ item.lastCountry || '--' }}{{ strConcat('/', item.lastCity) }}</span>
              <RxSvgIcon class="cursor-pointer" :class="{ 'pi-spin': checkResult.loading }" :name="checkResult.loading ? 'base/rx_ic_progress_bar' : 'base/rx_ic_speed_test'"
                @click.stop="testProxy(item, index)" />
            </div>
            <div class="flex justify-between single-time">{{ item.ipType }} {{ item.proxyCategory }}{{ strConcat('://', item.host) }}{{ strConcat(':', item.port) }}</div>
          </RxCard>
        </template>
      </div>
    </template>
  </div>
</template>

<style lang="scss" scoped>
.proxy-switch {
  :deep(.rx-radio-group-item) {
    min-width: 90px;
  }
}

.direct {
  margin-top: var(--spacing-xl, 12px);
  color: var(--colors-text-text-tertiary, #575D60);
  font-family: Inter;
  font-size: 12px;
  font-style: normal;
  font-weight: 400;
  line-height: 16px;
}

.button-group {
  margin-top: var(--spacing-xl, 12px);
  display: flex;
  align-items: center;
  gap: var(--spacing-lg, 8px);
  align-self: stretch;
}

.single {
  display: grid;
  grid-template-columns: 16px 1fr;
  grid-column-gap: var(--spacing-lg, 8px);
  grid-row-gap: var(--spacing-xs, 4px);
  margin-top: 10px;

  &-img {
    width: 16px;
    height: 16px;
    grid-row-start: span 2;
  }

  &-region {
    color: var(--colors-text-text-primary, #fafafa);
    font-family: Inter;
    font-size: 12px;
    font-style: normal;
    font-weight: 500;
    line-height: var(--Line-Height-text-xs, 16px);
  }

  &-time {
    color: var(--colors-text-text-inactive, #a3a9ad);
    font-family: Inter;
    font-size: 12px;
    font-style: normal;
    font-weight: 400;
    line-height: var(--Line-Height-text-xs, 16px);
  }
}

.multiple {
  display: flex;
  align-items: center;
  gap: var(--spacing-md, 6px);
  margin-top: 10px;

  &-region {
    display: flex;
    align-items: center;
    flex: 1;
    gap: var(--spacing-md, 6px);

    color: var(--colors-text-text-primary, #fafafa);
    font-family: Inter;
    font-size: 12px;
    font-style: normal;
    font-weight: 600;
    line-height: var(--Line-Height-text-lg, 20px);
  }
}
</style>
