<!-- eslint-disable ts/ban-ts-comment -->
<script setup lang="ts">
import { useDialog } from 'primevue/usedialog'
import { RxSvgIcon, type SvgNames } from '/@/components/rx-icon/'
import simplePopup from '/@/components/simplePopup'
import { isEmptyValue } from '/@/utils'
import proxyCreate from '/@/views/agent/create/quick.vue'
import { useCheckProxy } from '/@/views/agent/hooks'
import proxyTable from '/@/views/agent/list/quick.vue'
import { useTableContext } from '../hooks/useContext'

const dialog = useDialog()
const { isBatch, createCount } = useTableContext()

const [checkProxy, checkResult] = useCheckProxy()

const proxyList = defineModel<any>('modelValue')

const drawer = reactive({
  visible: false,
  type: 'create',
})

const isOverload = computed(() => {
  const sum = proxyList.value.reduce((sum: number, item: any) => {
    return sum + (item?._proxyCount || 0)
  }, 0)
  return sum > (createCount?.value || 0)
})

function toggleDrawer(type: 'create' | 'list') {
  drawer.visible = true
  drawer.type = type
}

function deleteProxy(index: number) {
  proxyList.value.splice(index, 1)
}

function confirm(data: any) {
  if (!isEmptyValue(data)) {
    proxyList.value = [].concat(data)
  }
}

async function testProxy(data: any) {
  await checkProxy(toRaw(data))
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
</script>

<template>
  <div>
    <div class="button-group">
      <RyButton size="small" severity="secondary" icon="base/rx_ic_exchange" label="Select"
        @click="toggleDrawer('list')" />
      <RyButton size="small" severity="secondary" icon="base/rx_ic_plus" label="Add proxy"
        @click="toggleDrawer('create')" />
    </div>
    <div>
      <template v-if="isBatch">
        <Message v-if="isOverload" severity="warn" class="multiple">
          Bound profiles must not exceed {{ createCount }}
        </Message>
        <RxCard v-for="(item, index) in proxyList" :key="index" class="multiple" @close="deleteProxy(index)">
          <div class="multiple-region">
            <RxSvgIcon name="base/rx_ic_earth" :size="16" />
            <span>{{ item.lastCountry }}/{{ item.lastCity }}</span>
            <RxSvgIcon v-tooltip.top="tooltipValue(item)" name="base/rx_ic_info_fill" :size="12" />
          </div>
          <RyTag severity="secondary" class="cursor-pointer" @click="modifyProxyCount(item)">
            <RxSvgIcon name="base/rx_ic_browser" :size="16" />
            <span>{{ item._proxyCount }}</span>
          </RyTag>
          <RxSvgIcon class="cursor-pointer" :class="{ 'pi-spin': checkResult.loading }" name="base/rx_ic_speed_test"
            :size="16" @click="testProxy(item)" />
        </RxCard>
      </template>

      <template v-else>
        <RxCard v-for="(item, index) in proxyList" :key="index" class="single" @close="deleteProxy(index)">
          <RxSvgIcon class="single-img" :name="(`country-code/${item.lastCountry}` as SvgNames)"
            fallback="base/rx_ic_earth" />
          <div class="flex justify-between single-region ">
            <span>{{ item.lastCountry }}/{{ item.lastCity }}</span>
            <RxSvgIcon class="cursor-pointer" :class="{ 'pi-spin': checkResult.loading }" name="base/rx_ic_speed_test"
              :size="16" @click="testProxy(item)" />
          </div>
          <div class="flex justify-between single-time">
            <span>{{ `${item.ipType || ''} ${item.proxyCategory || ''}://${item.host || ''}:${item.port || ''}`
              }}</span>
          </div>
        </RxCard>
      </template>
    </div>

    <Drawer v-model:visible="drawer.visible" position="right" class="browser-drawer-content !w-[auto]"
      :pt="{ mask: 'browser-drawer' }">
      <template #container="{ closeCallback }">
        <proxyTable v-if="drawer.type === 'list'" :data="proxyList" :is-batch="isBatch" @close="() => closeCallback()"
          @confirm="(data: any) => { closeCallback(); confirm(data) }" />
        <proxyCreate v-if="drawer.type === 'create'" @close="() => closeCallback()"
          @confirm="(data: any) => { closeCallback(); confirm(data) }" />
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
