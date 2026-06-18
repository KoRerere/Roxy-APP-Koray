<script setup lang="tsx">
import { h } from 'vue'
import HistoryDetail from '/@/views/browser/list/transfer/components/history-detail.vue';

import { API } from '/@/api'
import { useDialog } from '/@/hooks/useDialog'

const [showModal] = useDialog()

const typeMap = {
  Transfer: $t('窗口转移'),
  Receive: $t('窗口接收'),
}

const statusMap = {
  1: $t('转移中'),
  2: $t('转移成功'),
  3: $t('已拒绝'),
}

const columns = [
  {
    title: $t('时间'),
    key: 'createTime',
  },
  {
    title: $t('类型'),
    key: 'type',
    slot: 'type'
  },
  {
    title: $t('转移者'),
    key: 'transferor',
  },
  {
    title: $t('接收者'),
    key: 'receiver',
  },
  {
    title: $t('详情'),
    key: 'detail',
    slot: 'detail'
  },
  {
    title: $t('状态'),
    key: 'status',
    slot: 'status'
  },
]

function tableFilters() {
  return [
    {
      type: 'select',
      name: 'type',
      value: [],
      placeholder: $t('全部操作'),
      options: Object.entries(typeMap).map(([value, label]) => ({ label, value })),
    },
  ]
}

function tableRequest(params: any) {
  return API.window.userGetTransferRecordListList(params)
}

function viewDetail(item: any) {
  showModal({
    showHeader: false,
    modal: true,
    blockScroll: true,
    pt: {
      content: '!pa-0'
    },
    slots: {
      container: ({ hideModal }) => h(HistoryDetail, {
        transferTaskId: item.id,
        onClose: hideModal,
      })
    }
  })
}
</script>

<template>
  <div class="h-full flex overflow-hidden">
    <RyTable cacheKey="transfer-history" :table-filters="tableFilters" :columns="columns" :table-request="tableRequest" :show-actions="false" :show-display="false" :context-menu="false">
      <template #table-empty>
        <CustomEmpty icon="rx_illustration_transfer.svg" :title="$t('暂无转移窗口数据')">
          <template #extra>
            <div class="flex flex-col gap-3 help">
              <div>{{ $t('您可以直接将窗口转移到您拥有的其他团队。或者使用团队 ID 转移到他人的团队。') }}</div>
            </div>
          </template>
        </CustomEmpty>
      </template>
      <template #type="{ data }">
        <span :class="{ 'info': data.type === 'Receive' }">{{ typeMap[data.type as keyof typeof typeMap] }}</span>
      </template>
      <template #detail="{ data }">
        <div class="flex items-center gap-2.5">
          <span>{{ data.detail }}</span>
          <RxButton severity="secondary" variant="outlined" size="xxs" icon="base/rx_ic_doc_article" :label="$t('详情')" @click="viewDetail(data)"></RxButton>
        </div>
      </template>
      <template #status="{ data }">
        <span :class="{ 'error': data.status === 3 }">{{ statusMap[data.status as keyof typeof statusMap] }}</span>
      </template>
    </RyTable>
  </div>
</template>

<style lang="scss" scoped>
.help {
  color: var(--colors-text-text-inactive);
  font-size: 12px;
  line-height: 20px;
}

.info {
  color: var(--colors-text-text-info);
}

.error {
  color: var(--colors-text-text-error);
}
</style>
