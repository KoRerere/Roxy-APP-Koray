<script setup>
import ryTable from '/@/components/ry-table'
import ryTag from '/@/components/ry-tag'
import ryButton from '/@/components/ry-button'
import actions from '/@/components/actions.vue'
import drawerContent from '/@/components/drawer-content.vue'

const emits = defineEmits(['confirm'])

const columns = [
  {
    key: 'id',
    title: 'ID',
  },
  {
    key: 'Proxy',
    title: '代理',
    slot: 'proxy',
  },
  {
    key: 'Outbound_IP',
    title: '外部IP',
    slot: 'outbound',
  },
  {
    key: 'Related_Profiles',
    title: '相关简介',
    slot: 'related',
  },
  {
    key: 'Actions',
    title: '操作',
    slot: 'actions',
  },
]

const dataList = ref(
  Array.from({ length: 100 }, (_, index) => ({
    id: index,
    Proxy: 'mac',
    Outbound_IP: 'mac账号',
    Related_Profiles: 'aaaaaaaaaaa',
  })),
)

const filterButtons = reactive({
  value: 'All',
  options: [
    {
      key: 'All',
      name: 'All',
    },
    {
      key: 'SOCKS5',
      name: 'SOCKS 5',
    },
    {
      key: 'HTTP',
      name: 'HTTP',
    },
    {
      key: 'HTTPS',
      name: 'HTTPS',
    },
  ],
})

function getOperation (data) {
  return [
    {
      key: 'test',
      name: '测试',
      icon: 'mdi mdi-wifi-off',
      visible: true,
      quick: true,
      onClick: () => {
        testProxy(data)
      },
    },
    {
      key: 'refresh',
      name: '刷新',
      icon: 'mdi mdi-refresh',
      visible: data.id % 2 === 0,
      quick: true,
      onClick: () => {
        refreshProxy(data)
      },
    },
    {
      key: 'edit',
      name: '编辑',
      icon: 'mdi mdi-file-document-plus-outline',
      visible: true,
      quick: true,
      onClick: () => {
        editProxy(data)
      },
    },
  ].filter(item => item.visible)
}

function testProxy (data) {
  console.log('🚀 ~ testProxy ~ testProxy:', data)
}

function testAll () {
  console.log('🚀 ~ testAll ~ testAll:')
}

function refreshProxy (data) {
  console.log('🚀 ~ refreshProxy ~ refreshProxy:', data)
}

function editProxy (data) {
  console.log('🚀 ~ editProxy ~ editProxy:', data)
}

const rowSelectData = ref()

function onRowSelect ({ index }) {
  rowSelectData.value = dataList.value[index]
}

function saveSelected () {
  emits('confirm', rowSelectData.value)
}
</script>

<template>
  <drawer-content title="代理列表" v-bind="$attrs">
    <div class="h-full">
      <ry-table :data-list="dataList" :show-gridlines="false" :columns="columns" :show-config="false"
        selection-mode="single" @row-select="onRowSelect">
        <template #header-extra>
          <div class="flex flex-auto items-center justify-between">
            <SelectButton v-model="filterButtons.value" :options="filterButtons.options" option-label="name"
              option-value="key" data-key="key" />
            <ryButton severity="secondary">
              <span class="mdi mdi-wifi-refresh" />
              <span @click="testAll">Test All</span>
            </ryButton>
          </div>
        </template>
        <template #proxy>
          <div class="proxy-info">
            <div>
              socks5://gate3.rola.info:2189
            </div>
            <div class="proxy-info-type">
              IPv4
            </div>
          </div>
        </template>
        <template #outbound>
          <div class="outboundip">
            <div class="mdi mdi-web outboundip-img" />
            <div class="outboundip-nation">
              HK/HongKong
            </div>
            <div class="outboundip-time">
              5 days ago
            </div>
          </div>
        </template>
        <template #related>
          <div class="flex items-center gap-2">
            <ry-tag>
              <span class="mdi mdi-monitor mr-1" />
              <span>12345</span>
            </ry-tag>
            <ry-tag>
              +2
            </ry-tag>
          </div>
        </template>
        <template #actions="{ data }">
          <actions :operation="getOperation(data)" :show-menu="false" />
        </template>
      </ry-table>
    </div>
    <template #footer>
      <ry-button label="Save selected" severity="info" @click="saveSelected" />
    </template>
  </drawer-content>
</template>

<style lang="scss" scoped>
.proxy-info {
  display: flex;
  flex-direction: column;
  gap: var(--spacing-sm, 4px);
  min-width: 220px;
  color: var(--Color-neutrals-950, #0e1214);
  font-family: 'JetBrains Mono';
  font-size: 12px;
  font-style: normal;
  font-weight: 500;
  line-height: var(--Line-Height-text-xs, 16px);

  &-type {
    color: var(--Colors-Text-text-subtle, #c7cdd1);
    font-family: Inter;
    font-weight: 400;
  }
}

.outboundip {
  display: grid;
  grid-template-columns: 16px 1fr;
  grid-column-gap: var(--spacing-lg, 8px);
  grid-row-gap: var(--spacing-xs, 4px);

  &-img {
    font-size: 16px;
    line-height: 1;
    grid-row-start: span 2;
  }

  &-nation {
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
</style>
