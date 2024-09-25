<script setup lang="tsx">
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'
import { useTemplateRef } from 'vue'
import columnsRow from './columns'
import { useInviteUserFormDialog } from './hooks/useInviteUserFormDialog'
import { inviteUsersFormSchemas, projectFormSchemas } from './schemas'
import { API } from '/@/api'
import actions from '/@/components/actions.vue'

import RxButton from '/@/components/ry-button'
import ryTable from '/@/components/ry-table'
import useColumns from '/@/hooks/useColumns'
import { useFormDialog } from '/@/hooks/useFormDialog'
import { useProjectStore } from '/@/stores/project'

const tableRef = useTemplateRef('accountTable')
const [dialog] = useFormDialog()
const [showInviteUserFormDialog] = useInviteUserFormDialog()
const toast = useToast()
const confirm = useConfirm()
const { getProjects } = useProjectStore()

const [columns] = useColumns(columnsRow)

const operation = ref([
  {
    name: 'edit',
    label: '编辑',
    icon: 'base/rx_ic_edit',
    quick: true,
  },
  {
    name: 'invite',
    label: '邀请',
    icon: 'base/rx_ic_user_add',
    quick: true,
  },
  {
    name: 'delete',
    label: '删除',
    icon: 'base/rx_ic_bin_1',
    quick: true,
    multiple: true,
  },
])

async function operationHandler(operate: any, data?: any) {
  switch (operate.name) {
    case 'create':
      dialog.showModal({
        header: 'Create project',
        class: 'w-[500px]',
        schemas: projectFormSchemas,
        formProps: {
          layout: 'vertical',
        },
        async handleOk(formModel) {
          const { code, data, msg } = await API.limit.userAddProjectInfoCreate(formModel)
          tableRef.value?.refresh()
          if (code === 0) {
            toast.add({ severity: 'success', summary: '成功', detail: '创建成功', life: 3000 })
          }
          else {
            toast.add({ severity: 'error', summary: '失败', detail: msg || '创建失败', life: 3000 })
          }
        },
      })
      break
    case 'invite':
      showInviteUserFormDialog({ projectIds: [data.project_id], tableRef })

      break
    case 'edit':
      await dialog.showModal({
        header: 'Edit project',
        class: 'w-[500px]',
        schemas: projectFormSchemas,
        formProps: {
          layout: 'vertical',
        },
        async handleOk(formModel) {
          const { code, data, msg } = await API.limit.userMdfProjectInfoCreate(formModel)
          tableRef.value?.refresh()
          if (code === 0) {
            toast.add({ severity: 'success', summary: '成功', detail: '编辑成功', life: 3000 })
          }
          else {
            toast.add({ severity: 'error', summary: '失败', detail: msg || '编辑失败', life: 3000 })
          }
        },
      })

      dialog.formRef.value?.setFieldsValue({
        id: data.project_id,
        ...data,
      })
      break
    case 'delete':
      deletePopup(data)
      break
  }
}

function tableRequest(params: any) {
  return getProjects(params)
}

function deletePopup(data: any) {
  const datas = [].concat(data)
  confirm.require({
    header: '警告',
    message: `确定删除此项目(${data.projectName})吗?`,
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
      // const { msg } = await API.platform.userDelPlatformInfoCreate({ ids })
      toast.add({ severity: 'success', summary: '成功', detail: msg, life: 5000 })
    },
  })
}
</script>

<template>
  <div class="flex flex-col h-full account">
    <div class="flex justify-between account-header">
      <div>Projects</div>
      <RxButton size="small" severity="info" icon="base/rx_ic_plus" label="Add project"
                @click="operationHandler({ name: 'create' })"
      />
    </div>
    <div class="account-content">
      <ry-table ref="accountTable" selection-mode="multiple" :columns="columns" :table-request="tableRequest"
                :operation="operation" :operation-handler="operationHandler" :show-gridlines="false"
      >
        <template #members="{ data }">
          <AvatarGroup>
            <template v-for="person in data.user_info" :key="person.userId">
              <Avatar v-tooltip.top="person.userName" :label="person.userName.at(0)" shape="circle" />
            </template>
            <!-- <Avatar label="+2" shape="circle" /> -->
          </AvatarGroup>
        </template>
        <template #open="{ data }">
          <RxButton outlined>
            <router-link :to="{ name: 'project-item', params: { id: data.project_id } }" class="text-black">
              Detail
            </router-link>
          </RxButton>
        </template>
        <template #actions="{ data }">
          <div class="flex gap-2">
            <actions :operation="operation" :show-menu="false"
                     @quick-click="(operate: any) => operationHandler(operate, data)"
            />
          </div>
        </template>
      </ry-table>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.account {
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

.platform {
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
