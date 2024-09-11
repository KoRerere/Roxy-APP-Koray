<script setup lang="ts">
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import { useTemplateRef } from 'vue'
import columnsRow from './columns'
import { getOperation, getSorts } from './operation'
import { API } from '/@/api'
import actions from '/@/components/actions.vue'
import ryTable from '/@/components/ry-table'
import useColumns from '/@/hooks/useColumns'
import profileInfo from '/@/views/browser/list/profiles/components/profile-info.vue'

const confirm = useConfirm()
const toast = useToast()

const [columns] = useColumns(columnsRow)

const operation = getOperation()
const sorts = ref(getSorts())

const tableRef = useTemplateRef('recycleTable')

async function tableRequest(params: any) {
  return API.window.userGetWindowInfoRecycleList(params)
}

function operationHandler(operate: any, data: any) {
  const datas = [].concat(data)
  switch (operate.name) {
    case 'recover':
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
    header: '警告',
    message: '此操作不可逆, 确认要彻底删除吗？',
    rejectProps: {
      label: '取消',
      severity: 'secondary',
      outlined: true,
    },
    acceptProps: {
      label: '确定',
      severity: 'danger',
    },
    accept: async () => {
      const ids = datas.map((item: any) => item.id)
      const { msg } = await API.window.userDelWindowInfoCreate({ ids })
      toast.add({ severity: 'success', summary: '成功', detail: msg, life: 5000 })
      tableRef.value?.refresh()
    },
  })
}
</script>

<template>
  <div class="flex flex-col flex-1 proxies">
    <div class="proxies-header">
      回收站
    </div>
    <div class="proxies-content">
      <!-- eslint-disable-next-line vue/no-unused-refs -->
      <ry-table ref="recycleTable" selection-mode="multiple" :columns="columns" :table-request="tableRequest"
        :operation="operation" :operation-handler="operationHandler" :sorts="sorts" :show-gridlines="false">
        <template #profile="{ data }">
          <profileInfo :data="data" disabled />
        </template>
        <template #log="{ data }">
          <div>{{ data.createUser }}</div>
          <div>{{ data.deleteTime }}</div>
        </template>
        <template #actions="{ data }">
          <div class="flex gap-2">
            <remarkIcon :value="data.windowRemark" disabled />
            <actions :operation="operation" :show-menu="false"
              @quick-click="(operate) => operationHandler(operate, data)" />
          </div>
        </template>
      </ry-table>
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
