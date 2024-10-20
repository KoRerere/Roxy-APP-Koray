<script setup lang="ts">
import { useConfirm } from 'primevue/useconfirm'
import { useTemplateRef } from 'vue'
import { API } from '/@/api'
import actions from '/@/components/actions.vue'
import useColumns from '/@/hooks/useColumns'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { $t } from '/@/locales'
import profileInfo from '/@/views/browser/list/profiles/components/profile-info.vue'
import columnsRow from './columns'
import { getOperation, getSorts } from './operation'

const confirm = useConfirm()

const [columns] = useColumns(columnsRow)

const [showToast] = useResponseToast()

const operation = getOperation()
const sorts = ref(getSorts())

const tableRef = useTemplateRef('recycleTable')

async function tableRequest(params: any) {
  // 1: 已删除
  return API.window.userGetWindowInfoV2List({ ...params, isDelete: 1 })
}

function operationHandler(operate: any, data: any) {
  const datas = [].concat(data)
  switch (operate.name) {
    case 'restore':
      recoverHandler(datas)
      break
    case 'delete':
      deleteHandler(datas)
      break
  }
}

async function recoverHandler(datas: any) {
  const ids = datas.map((item: any) => item.id)
  await API.window.userMdfWindowInfoBatchCreate({ ids, isDelete: false } as any)
  tableRef.value?.refresh()
}

async function deleteHandler(datas: any) {
  confirm.require({
    header: $t('Are you sure to delete the profiles you selected? '),
    message: $t('This action can not be undone.'),
    rejectProps: {
      label: $t('Cancel'),
      severity: 'secondary',
      outlined: true,
    },
    acceptProps: {
      label: $t('Confirm'),
      severity: 'danger',
    },
    accept: async () => {
      const ids = datas.map((item: any) => item.id)
      const { code, msg } = await API.window.userDelWindowInfoCreate({ ids })
      showToast(code, msg)
      tableRef.value?.refresh()
    },
  })
}
</script>

<template>
  <div class="flex flex-col flex-1 proxies">
    <div class="proxies-content">
      <!-- eslint-disable-next-line vue/no-unused-refs -->
      <RyTable ref="recycleTable" selection-mode="multiple" :columns="columns" :table-request="tableRequest"
        :operation="operation" :operation-handler="operationHandler" :sorts="sorts" :show-gridlines="false">
        <template #profile="{ data }">
          <profileInfo :data="data" disabled />
        </template>
        <template #log="{ data }">
          <div>{{ data.email }}</div>
          <div>{{ data.updateTime }}</div>
        </template>
        <template #actions="{ data }">
          <div class="flex gap-2">
            <remarkIcon :value="data.windowRemark" disabled />
            <actions :operation="operation" :show-menu="false"
              @quick-click="(operate) => operationHandler(operate, data)" />
          </div>
        </template>
      </RyTable>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.proxies {
  &-header {
    padding: var(--spacing-xl, 12px) var(--spacing-4xl, 24px);
    gap: 10px;
    height: 48px;
    color: #000;
    font-family: Inter;
    font-size: 16px;
    font-style: normal;
    font-weight: 600;
    line-height: var(--Line-Height-text-xl, 24px);
    border-bottom: 0.5px solid var(--Colors-Border-border-container, #c7cdd1);
  }

  &-content {
    height: calc(100% - 48px);
  }
}

.outbound {
  display: grid;
  grid-template-columns: 16px 1fr;
  grid-column-gap: var(--spacing-md, 8px);
  grid-row-gap: var(--spacing-sm, 4px);

  font-family: Inter;
  font-size: 12px;
  font-style: normal;
  line-height: var(--Line-Height-text-xs, 16px);
  font-weight: 400;

  &-img {
    width: 16px;
    height: 16px;
    grid-row-start: span 2;
  }

  &-region {
    color: var(--Colors-Text-text-primary, #171c1f);
    font-weight: 500;
  }

  &-email {
    gap: var(--spacing-sm, 4px);
    color: var(--Colors-Text-text-inactive, #a3a9ad);
  }
}
</style>
