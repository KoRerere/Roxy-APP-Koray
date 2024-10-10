<script lang="ts" setup>
import type { SelectButtonChangeEvent } from 'primevue/selectbutton'
import { useToast } from 'primevue/usetoast'
import { API } from '/@/api'
import actions from '/@/components/actions.vue'
import drawerContent from '/@/components/drawer-content.vue'
import { RxSvgIcon } from '/@/components/rx-icon/'
import { ProxyProtocol } from '/@/enums/proxy'
import { setColumns } from '/@/hooks/useColumns'
import { setRowsLoading } from '/@/utils'
import { useCheckProxy } from '/@/views/agent/hooks'
import outboundIp from '/@/views/agent/list/components/outbound-ip.vue'
import proxyColumns from './columns'
import { type ProxyItem, tableOperation, tableRequest } from './operation'

interface Boundeds {
  [id: number]: {
    value: number
    disabled: boolean
  }
}

const props = defineProps({
  data: {
    type: [Object, Array] as PropType<any>,
    default: undefined,
  },
  isBatch: {
    type: Boolean,
    default: false,
  },
})

const emit = defineEmits(['confirm'])

const toast = useToast()
const [checkProxy] = useCheckProxy()
const tableRef = useTemplateRef('agent')

const columns = setColumns(proxyColumns.data, {
  inserts: props.isBatch ? [[4, { title: 'Bounded Profiles', slot: 'bounded' }]] : [],
  filters: ['ipChecker'],
})

const selection = ref(props.data)

const dataList = ref()

const boundeds = ref<Boundeds>({})

const filterButtons = reactive({
  value: null,
  options: [
    {
      name: 'All',
      value: null,
    },
    {
      name: 'SOCKS 5',
      value: ProxyProtocol.SOCKS5,
    },
    {
      name: 'HTTP',
      value: ProxyProtocol.HTTP,
    },
    {
      name: 'HTTPS',
      value: ProxyProtocol.HTTPS,
    },
  ],
  onChange({ value }: SelectButtonChangeEvent) {
    tableRef.value?.refresh({ protocol: value })
  },
})

const tableProps = {
  columns,
  showDisplay: false,
  showGridlines: false,
  contextMenu: false,
  multipleOperation: false,
  ...(!props.isBatch
    ? {}
    : {
      onRowSelect({ data }: any) {
        boundeds.value[data.id].disabled = false
      },
      onRowSelectAll({ data }: any) {
        data.forEach((item: any) => {
          boundeds.value[item.id].disabled = false
        })
      },
      onRowUnselect({ data }: any) {
        boundeds.value[data.id].disabled = true
      },
      onRowUnselectAll() {
        boundeds.value = Object.fromEntries(Object.entries(boundeds.value).map(([id, item]) => [id, { ...item, disabled: true }]))
      },
    }),
}

async function getTableList(params: any) {
  const data = await tableRequest(params)
  dataList.value = data.data.rows
  if (props.isBatch) {
    boundeds.value = Object.fromEntries(
      data.data.rows.map(item => [item.id, {
        value: 1,
        disabled: !props.data.some((it: any) => item.id === it.id),
      }],
      ),
    )
  }
  return data
}

function operationHandler(operate: any, data: ProxyItem) {
  const datas = ([] as ProxyItem[]).concat(data)
  switch (operate.name) {
    case 'refresh':
      refreshUrl(datas)
      break
    case 'test':
      testProxy(datas, operate.name)
      break
  }
}

function refreshUrl(datas: ProxyItem[]) {
  datas.forEach(async (item) => {
    const isOK = await window.electronAPI.send('proxy:refreshUrl', item.refreshUrl!)
    toast.add({ severity: isOK ? 'success' : 'error', summary: isOK ? 'Success' : 'Failure', detail: item.refreshUrl, life: 5000 })
  })
}

async function testProxy(datas: ProxyItem[], operateName: string) {
  for (const item of datas) {
    setRowsLoading(item, operateName, () => checkProxy(toRaw(item)))
      .then(async (checkResult) => {
        await API.proxy.userMdfProxyModuleCreate([{ ...toRaw(checkResult), id: item.id } as any])
        Object.assign(item, toRaw(checkResult))
      })
  }
}

function testAllProxy() {
  testProxy(dataList.value, 'test')
}

function saveSelected() {
  const _selection = !props.isBatch
    ? selection.value
    : selection.value.map((item: any) => ({ ...item, _proxyCount: boundeds.value[item.id].value }))

  emit('confirm', _selection)
}
</script>

<template>
  <drawer-content title="代理列表" v-bind="$attrs">
    <div class="h-full">
      <!-- eslint-disable-next-line vue/no-unused-refs -->
      <RyTable ref="agent" v-model:selection="selection" :table-request="getTableList"
        :selection-mode="isBatch ? 'multiple' : 'single'" v-bind="tableProps">
        <template #header-extra>
          <div class="flex flex-auto items-center justify-between">
            <SelectButton v-model="filterButtons.value" :options="filterButtons.options" option-label="name"
              option-value="value" data-key="value" @change="filterButtons.onChange" />
            <ryButton severity="secondary" icon="base/rx_ic_speed_test" label="Test All" @click="testAllProxy" />
          </div>
        </template>
        <template #proxy="{ data: row }">
          <div class="proxy-host">
            <span>{{ row.protocol }}://</span><span>{{ row.host }}</span><span>:{{ row.port }}</span>
          </div>
          <div class="ip-type">
            {{ row.ipType }}
          </div>
        </template>
        <template #outbound="{ data: row }">
          <outboundIp :image="row.region" :country="row.lastCountry" :city="row.lastCity" :time="row.checkTime" />
        </template>
        <template #related="{ data: row }">
          <relatedInfo :list="row.bindList" />
        </template>
        <template #bounded="{ data: row }">
          <div class="w-30">
            <InputNumber v-model="boundeds[row.id].value" :disabled="boundeds[row.id].disabled" :min="0" show-buttons
              button-layout="horizontal" :step="1" fluid>
              <template #incrementicon>
                <RxSvgIcon name="base/rx_ic_plus" />
              </template>
              <template #decrementicon>
                <RxSvgIcon name="base/rx_ic_minus" />
              </template>
            </InputNumber>
          </div>
        </template>
        <template #actions="{ data: row }">
          <actions :operation="tableOperation(row)" :loading-operation-map="row.loadingOperationMap" :show-menu="false"
            @quick-click="operationHandler($event, row)" />
        </template>
      </RyTable>
    </div>
    <template #footer>
      <RyButton label="Save selected" severity="info" @click="saveSelected" />
    </template>
  </drawer-content>
</template>

<style lang="scss" scoped>
.proxy-host {
  color: var(--Color-neutrals-950, #0e1214);
  font-family: 'JetBrains Mono';
  font-size: 12px;
  font-style: normal;
  font-weight: 500;
  line-height: var(--Line-Height-text-xs, 16px);
}

.ip-type {
  color: var(--Colors-Text-text-subtle, #c7cdd1);
  font-family: Inter;
  font-size: 12px;
  font-style: normal;
  font-weight: 400;
  line-height: var(--Line-Height-text-xs, 16px);
}
</style>
