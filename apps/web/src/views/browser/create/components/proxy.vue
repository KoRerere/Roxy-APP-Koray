<!-- eslint-disable ts/ban-ts-comment -->
<script setup lang="ts">
import rxCard from '/@/components/rx-card'
import ryButton from '/@/components/ry-button'
import ryTag from '/@/components/ry-tag'
// @ts-ignore
import proxyTable from '/@/views/browser/components/drawers/proxy-list.vue'
import proxyCreate from '/@/views/agent/create/quick.vue'
import { useVModel } from '@vueuse/core'
import { getImage } from '/@/utils'
import { useTableContext } from '../hooks/useContext'

const props = defineProps({
  modelValue: {
    type: Object as PropType<any>,
    default: () => ({}),
  },
})

const emits = defineEmits(['update:modelValue'])

const { isBatch, createCount } = useTableContext()

const proxyList = useVModel(props, 'modelValue', emits)

const isOverload = computed(() => {
  const sum = proxyList.value.reduce((sum: number, item: any) => {
    return sum + (item?.proxyCount || 0)
  }, 0)
  return sum > (createCount?.value || 0)
})

const proxyState = reactive({
  region: getImage('proxy.svg'),
  state: 'success',
  isTestProxy: false,
  isRefresh: false,
  loading: 'mdi mdi-selection-ellipse',
  ipIcon: 'mdi mdi-refresh',
  proxyIcon: 'mdi mdi-wifi-refresh',
  help: 'Enter your username to reset your password.',
  helpIcon: 'mdi mdi-web',
})

const icons = computed(() => {
  return {
    ip: proxyState.isRefresh ? proxyState.loading : proxyState.ipIcon,
    proxy: proxyState.isTestProxy ? proxyState.loading : proxyState.proxyIcon,
    help: proxyState.helpIcon,
  }
})

const drawer = reactive({
  visible: false,
  type: 'create',
})

function toggleDrawer(type: 'create' | 'list') {
  drawer.visible = true
  drawer.type = type
}

function deleteProxy(index: number) {
  proxyList.value.splice(index, 1)
}

function confirm(data: any) {
  if (isBatch) {
    proxyList.value.push({
      ...data,
      proxyCount: 1,
    })
  }
  else {
    proxyList.value[0] = data
  }
}

function testProxy() {
  proxyState.isTestProxy = true

  setTimeout(() => {
    proxyState.isTestProxy = false
  }, 2000)
}

function refreshIp() {
  proxyState.isRefresh = true

  setTimeout(() => {
    proxyState.isRefresh = false
  }, 2000)
}

function modifyProxyCount() {
  // dialog.open(simplePopup, {
  //   props: {
  //     showHeader: false,
  //     modal: true,
  //     blockScroll: true,
  //   },
  //   data: {
  //     inputs: [
  //       {
  //         type: 'number',
  //         placeholder: '请输入代理数量',
  //         name: 'proxyCount',
  //         value: null,
  //         required: true,
  //       },
  //     ],
  //   },
  //   emits: {
  //     onSave: ([formData, close]: [any, () => void]) => {
  //       proxyList.value[index].proxyCount = Number.parseInt(formData.proxyCount)
  //       close()
  //     },
  //   },
  // })
}
</script>

<template>
  <div>
    <div class="button-group">
      <ry-button size="small" severity="secondary" icon="mdi mdi-swap-horizontal" label="Select"
        @click="toggleDrawer('list')" />
      <ry-button size="small" severity="secondary" icon="mdi mdi-plus" label="Add proxy"
        @click="toggleDrawer('create')" />
    </div>
    <!-- <small class="proxy-help">
        <span :class="icons.help" />
        <span>{{ proxyState.help }}</span>
      </small> -->
    <div>
      <template v-if="isBatch">
        <!-- todo: 超出校验 -->
        <Message v-if="isOverload" severity="warn" class="multiple">
          Bound profiles must not exceed {{ createCount }}
        </Message>
        <rx-card v-for="(item, index) in proxyList" :key="index" class="multiple" @close="deleteProxy(index)">
          <div class="multiple-region">
            <img style="width: 16px;" :src="proxyState.region">
            <span>US/United States</span>
            <span class="mdi mdi-alert-octagon" />
          </div>
          <ryTag class="cursor-pointer" @click="modifyProxyCount">
            <span class="mdi mdi-web" />
            <span>{{ item.proxyCount }}</span>
          </ryTag>
          <span class="cursor-pointer mdi mdi-wifi" />
          <span class="cursor-pointer mdi mdi-refresh" />
        </rx-card>
      </template>

      <template v-else>
        <rx-card v-for="(item, index) in proxyList" :key="index" class="single" @close="deleteProxy(index)">
          <img class="single-img" :src="proxyState.region">
          <div class="flex justify-between single-region ">
            <span :class="proxyState.state">--</span>
            <span class="cursor-pointer" :class="icons.proxy" @click="testProxy" />
          </div>
          <div class="flex justify-between single-time">
            <span>{{ `${item.ipType || ''} ${item.proxyCategory || ''}://${item.host || ''}:${item.port || ''}`
              }}</span>
            <span class="cursor-pointer" :class="icons.ip" @click="refreshIp" />
          </div>
        </rx-card>
      </template>
    </div>

    <Drawer v-model:visible="drawer.visible" position="right" class="browser-drawer-content !w-[auto]"
      :pt="{ mask: 'browser-drawer' }">
      <template #container="{ closeCallback }">
        <proxyTable v-if="drawer.type === 'list'" @close="() => closeCallback()"
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

  &-help {
    display: flex;
    margin-top: var(--spacing-sm, 4px);
    gap: var(--spacing-sm, 4px);
    color: var(--Colors-Text-text-tertiary, #7c8387);
    font-family: Inter;
    font-size: 10px;
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
