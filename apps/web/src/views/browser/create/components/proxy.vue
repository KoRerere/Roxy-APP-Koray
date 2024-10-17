<!-- eslint-disable ts/ban-ts-comment -->
<script setup lang="ts">
import { useDialog } from 'primevue/usedialog'
import { RxSvgIcon, type SvgNames } from '/@/components/rx-icon/'
import simplePopup from '/@/components/simplePopup'
import { isEmptyValue, strConcat } from '/@/utils'
import proxyCreate from '/@/views/agent/create/quick.vue'
import { useCheckProxy } from '/@/views/agent/hooks'
import proxyTable from '/@/views/agent/list/quick.vue'
import { useTableContext } from '../hooks/useContext'

const dialog = useDialog()
const { isBatch, createCount } = useTableContext()

const [checkProxy, checkResult] = useCheckProxy()

const proxyList = defineModel<any>('modelValue')

const checkIndex = ref()

const drawer = reactive({
  dismissable: false,
  visible: false,
  type: 'create',
  data: undefined,
})

const isOverload = computed(() => {
  const sum = proxyList.value.reduce((sum: number, item: any) => {
    return sum + (item?._proxyCount || 0)
  }, 0)
  return sum > (createCount?.value || 0)
})

const selectedPorxys = computed(() => proxyList.value.filter((item: any) => item.id))

function toggleDrawer(type: 'create' | 'list', data?: any) {
  drawer.visible = true
  drawer.type = type
  drawer.dismissable = type === 'list'
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
  await checkProxy(toRaw(data))
  Object.assign(data, checkResult)
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
        title: 'man!',
        content: 'proxy count',
        inputs: [
          {
            type: 'number',
            placeholder: '请输入代理数量',
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
    `${item.protocol}://${item.host}:${item.port}`,
    `Refresh URL: ${item.refreshUrl}`,
    `Country: ${item.lastCountry}/${item.lastCity}`,
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
  <div>
    <div class="button-group">
      <RyButton size="small" severity="secondary" icon="base/rx_ic_exchange" label="Select"
        @click="toggleDrawer('list')" />
      <RyButton v-if="isBatch || !proxyList?.length" size="small" severity="secondary" icon="base/rx_ic_plus"
        label="Add proxy" @click="toggleDrawer('create')" />
    </div>
    <div>
      <template v-if="isBatch">
        <Message v-if="isOverload" severity="warn" class="multiple">
          Bound profiles must not exceed {{ createCount }}
        </Message>
        <RxCard v-for="(item, index) in proxyList" :key="index" class="multiple" @click="onEdit(item)"
          @close="deleteProxy(index)">
          <div class="multiple-region">
            <RxSvgIcon class="single-img" :name="(`country-code/${item.lastCountry}` as SvgNames)"
              fallback="base/rx_ic_earth" />
            <span>{{ item.lastCountry || '--' }}{{ strConcat('/', item.lastCity) }}</span>
            <RxSvgIcon v-tooltip.top="tooltipValue(item)" name="base/rx_ic_info_fill" :size="12" />
          </div>
          <RyTag severity="secondary" class="cursor-pointer" @click.stop="modifyProxyCount(item)">
            <RxSvgIcon name="base/rx_ic_browser" :size="16" />
            <span>{{ item._proxyCount }}</span>
          </RyTag>
          <RxSvgIcon class="cursor-pointer" :class="{ 'pi-spin': checkIndex === index && checkResult.loading }"
            :name="(checkIndex === index && checkResult.loading) ? 'base/rx_ic_progress_bar' : 'base/rx_ic_speed_test'"
            @click.stop="testProxy(item, index)" />
        </RxCard>
      </template>

      <template v-else>
        <RxCard v-for="(item, index) in proxyList" :key="index" class="single" @click="onEdit(item)"
          @close="deleteProxy(index)">
          <RxSvgIcon class="single-img" :name="(`country-code/${item.lastCountry}` as SvgNames)"
            fallback="base/rx_ic_earth" />
          <div class="flex justify-between single-region ">
            <span>{{ item.lastCountry || '--' }}{{ strConcat('/', item.lastCity) }}</span>
            <RxSvgIcon class="cursor-pointer" :class="{ 'pi-spin': checkResult.loading }"
              :name="checkResult.loading ? 'base/rx_ic_progress_bar' : 'base/rx_ic_speed_test'"
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

    <Drawer v-model:visible="drawer.visible" :dismissable="drawer.dismissable" position="right"
      class="browser-drawer-content !w-[auto]" :pt="{ mask: 'browser-drawer' }">
      <template #container="{ closeCallback }">
        <proxyTable v-if="drawer.type === 'list'" :data="selectedPorxys" :is-batch="isBatch" @close="closeCallback"
          @confirm="(data: any) => { onChoose(data); closeCallback() }" />
        <proxyCreate v-if="drawer.type === 'create'" :title="$t('Create Proxy')" :data="drawer.data"
          @close="closeCallback" @confirm="(data: any) => { addProxy(data); closeCallback() }" />
      </template>
    </Drawer>
  </div>
</template>

<style lang="scss" scoped>
.button-group {
  display: flex;
  padding: var(--spacing-sm, 4px) var(--spacing-none, 0px);
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
