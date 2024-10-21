<script setup lang="ts">
import { useConfirm } from 'primevue/useconfirm'
import { useTemplateRef } from 'vue'
import { API } from '/@/api'
import actions from '/@/components/actions.vue'
import useColumns from '/@/hooks/useColumns'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { $t } from '/@/locales'
import profileInfo from '/@/views/browser/list/profiles/components/profile-info.vue'
import TagsIcon from '/@/views/browser/list/profiles/components/tags-icon.vue'
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
      if (code === 0) {
        electronAPI.send('browser:batchRemove', toRaw(datas))
      }
    },
  })
}
</script>

<template>
  <!-- eslint-disable-next-line vue/no-unused-refs -->
  <RyTable ref="recycleTable" selection-mode="multiple" :columns="columns" :table-request="tableRequest"
           :operation="operation" :operation-handler="operationHandler" :sorts="sorts" :show-gridlines="false"
           :show-actions="false"
  >
    <template #profile="{ data }">
      <profileInfo :data="data" disabled />
    </template>
    <template #tags="{ data }">
      <TagsIcon :labels="data.labelInfo" :project-id="data.projectId" disabled />
    </template>
    <template #log="{ data }">
      <div class="delete-name">
        {{ data.email }}
      </div>
      <div class="delete-time">
        {{ data.updateTime }}
      </div>
    </template>
    <template #actions="{ data }">
      <div class="flex gap-2">
        <remarkIcon :value="data.windowRemark" disabled />
        <actions :operation="operation" :show-menu="false"
                 @quick-click="(operate) => operationHandler(operate, data)"
        />
      </div>
    </template>
  </RyTable>
</template>

<style lang="scss" scoped>
.delete-name {
  color: #000;
  font-family: Inter;
  font-size: 12px;
  line-height: var(--Line-Height-text-xs, 16px);
}

.delete-time {
  color: var(--Colors-Text-text-tertiary, #7c8387);
  font-family: Inter;
  font-size: 10px;
  line-height: var(--Line-Height-text-xs, 16px);
}
</style>
