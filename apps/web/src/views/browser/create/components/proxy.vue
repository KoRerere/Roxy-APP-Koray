<!-- eslint-disable ts/ban-ts-comment -->
<script setup lang="ts">
import { useDialog } from 'primevue/usedialog'
import { RxAlert } from '/@/components/rx-alert'
import { RxSvgIcon, type SvgNames } from '/@/components/rx-icon/'
import RxInputRadio from '/@/components/ry-form/rx-input-radio.vue'
import simplePopup from '/@/components/simplePopup'
import { $t } from '/@/locales'
import { useNetworkStore } from '/@/stores/network'
import { isEmptyValue, strConcat } from '/@/utils'
import ProxyCreate from '/@/views/agent/create/quick.vue'
import { useCheckProxy } from '/@/views/agent/hooks'
import ProxyTable from '/@/views/agent/list/quick.vue'
import { useTableContext } from '../hooks/useContext'

defineOptions({
  inheritAttrs: false,
})

const props = defineProps({
  windowInfo: {
    type: Object,
    default: () => ({}),
  },
})

const dialog = useDialog()
const network = useNetworkStore()

const [checkProxy, checkResult] = useCheckProxy()
const { isBatch, createCount } = useTableContext()

const proxyList = defineModel<any>('modelValue')
const proxySwitch = defineModel('proxySwitch', { default: false })

const checkIndex = ref()
const drawer = reactive({
  title: '',
  dismissable: false,
  visible: false,
  type: 'create',
  data: undefined,
})
const sumProxyCount = computed(() => proxyList.value.reduce((sum: number, item: any) => sum + (item?._proxyCount || 0), 0))
const selectedPorxys = computed(() => proxyList.value.filter((item: any) => item.id))
const proxyInfo = computed(() => {
  const filterKeys = ['ipType','proxyCategory','host','port','proxyUserName','proxyPassword','refreshUrl','checkChannel']

  return filterKeys.reduce((acc, key) => {
    acc[key] = props.windowInfo[key]
    return acc
  }, {} as Record<string, any>)
})

function toggleDrawer(type: 'create' | 'list', data?: any) {
  drawer.visible = true
  drawer.type = type
  drawer.dismissable = type === 'list'
  drawer.title = type === 'list' ? $t('代理列表') : $t('添加代理')
  drawer.data = data
}

function onEdit(item: any) {
  if (item.id) {
    toggleDrawer('list')
  }
  else {
    toggleDrawer('create', item)
  }
}

function deleteProxy(index: number) {
  proxyList.value.splice(index, 1)
}

function addProxy(data: any) {
  if (data._tempId) {
    replaceData(data)
    return
  }

  if (!data.id) {
    data._tempId = (new Date().getTime()).toString(32)
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
  Object.assign(data, result)
}

function modifyProxyCount(item: any) {
  dialog.open(simplePopup, {
    props: {
      showHeader: false,
      modal: true,
      blockScroll: true,
    },
    data: {
      props: {
        content: $t('设置绑定的窗口数量'),
        inputs: [
          {
            type: 'number',
            placeholder: $t('请输入数字'),
            name: 'proxyCount',
            value: item._proxyCount,
            required: true,
          },
        ],
      },
      onConfirm: (formData: any) => {
        item._proxyCount = Number.parseInt(formData.proxyCount)// 创建时补全代理数量需要用到
      },
    },
  })
}

function tooltipValue(item: any) {
  const value = [
    `Proxy Info`,
    item.ipType,
    `${strConcat(item.protocol, '://')}${item.host}${strConcat(':', item.port)}`,
    `Refresh URL: ${item.refreshUrl}`,
    `Country: ${item.lastCountry}${strConcat('/', item.lastCity) || ''}`,
    `Check Time: ${item.checkTime}`,
  ]
  return {
    value: value.join('\n').replace(/(\/|:)?undefined/g, '--'),
    showDelay: 500,
  }
}

function replaceData(data: any) {
  const index = proxyList.value.findIndex((item: any) => item._tempId === data._tempId)
  if (index > -1) {
    const old = proxyList.value[index]
    Reflect.set(proxyList.value, index, { ...old, ...data })
  }
}
</script>

<template>
  <div class="w-full">
    <div class="proxy-switch">
      <RxInputRadio v-model="proxySwitch" size="xs" name="proxySwitch" :options="[{ label: $t('直连'), value: false }, { label: $t('使用代理'), value: true }]" />
    </div>
    <div v-if="!proxySwitch" class="direct">
      {{ $t('* 不使用代理则默认通过本地直连 ({value})', { value: `${strConcat(network.info?.country_code, strConcat('/', network.info?.city))}` }) }}
    </div>
    <template v-else>
      <div class="button-group">
        <RxButton size="xxs" outlined severity="secondary" icon="base/rx_ic_exchange" :label="$t('选择')" @click="toggleDrawer('list', proxyInfo)" />
        <RxButton v-if="isBatch || !proxyList?.length" size="xxs" outlined severity="secondary" icon="base/rx_ic_plus" :label="$t('添加')" @click="toggleDrawer('create', proxyInfo)" />
      </div>
      <div>
        <template v-if="isBatch">
          <RxAlert v-if="sumProxyCount > createCount" class="w-full multiple" type="warn"
            :title="$t('{count} 个窗口将会绑定代理。您创建的窗口数为：{max}。{message}', { count: sumProxyCount, max: createCount, message: $t('当前选择绑定的代理数量已超过创建窗口数。') })" :closable="false" />
          <RxCard v-for="(item, index) in proxyList" :key="index" class="multiple" @click="onEdit(item)" @close="deleteProxy(index)">
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
            <div class="flex justify-between single-time">
              <span>
                {{ item.ipType }} {{ strConcat(item.proxyCategory, '://') }}{{ item.host }}{{ strConcat(':', item.port) }}
              </span>
            </div>
          </RxCard>
        </template>
      </div>
    </template>

    <RxDrawer v-model:visible="drawer.visible" :dismissable="drawer.dismissable" :title="drawer.title">
      <template #default="{ closeCallback }">
        <ProxyTable v-if="drawer.type === 'list'" :data="selectedPorxys" :is-batch="isBatch" :create-count="createCount" @close="closeCallback"
          @confirm="(data: any) => { onChoose(data); closeCallback() }" />
        <ProxyCreate v-if="drawer.type === 'create'" :data="drawer.data" @close="closeCallback" @confirm="(data: any) => { addProxy(data); closeCallback() }" />
      </template>
    </RxDrawer>
  </div>
</template>

<style lang="scss" scoped>
.proxy-switch {
  :deep(.rx-radio-group) {
    // gap: var(--spacing-4xl, 24px);

    .rx-radio-group-item {
      // padding-left: 0;
      // border: none;
      // min-width: auto;
      // box-shadow: none;
      min-width: 90px;
    }
  }
}

.direct {
  margin-top: var(--spacing-xl, 12px);
  color: var(--Colors-Text-text-tertiary, #7c8387);
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
    color: var(--Colors-Text-text-primary, #171c1f);
    font-family: Inter;
    font-size: 12px;
    font-style: normal;
    font-weight: 500;
    line-height: var(--Line-Height-text-xs, 16px);
  }

  &-time {
    color: var(--Colors-Text-text-inactive, #a3a9ad);
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

    color: var(--Colors-Text-text-primary, #171c1f);
    font-family: Inter;
    font-size: 12px;
    font-style: normal;
    font-weight: 600;
    line-height: var(--Line-Height-text-lg, 20px);
  }
}
</style>
