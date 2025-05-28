<script setup lang="tsx">
import { Role } from '/@/enums';
import { useWorkspaceStore } from '/@/stores/workspace';
import WorkspaceList from './workspace-list.vue';
import { RxSvgIcon } from '/@/components/rx-icon';
import { useDialog } from '/@/hooks/useDialog';
import { useUserStore } from '/@/stores/user';
import { useToast } from 'primevue/usetoast';
import { useHandleBusinessCode } from '/@/hooks/useResponseToast/handleBusinessCode';
import { BUSINESS_CODE } from '/@/constants/business-code';
import { $t } from '/@/locales';
import WorkspaceForm from '/@/views/workspace-setting/workspace-form.vue'
import WorkspaceGuide from '../components/workspace-guide.vue'
import { API } from '/@/api';

const { hideFn } = defineProps<{
  hideFn: () => any,
}>()

const workspaceStore = useWorkspaceStore()
const { workspaceList } = storeToRefs(workspaceStore)
const userStore = useUserStore()
const { handleBusinessCode } = useHandleBusinessCode()
const [showWorkspaceFormDialog] = useDialog()
const [showModal] = useDialog()
const toast = useToast()
const { userPayInfo } = storeToRefs(useUserStore())

const workspaceForm = ref({
  workspaceName: '',
  workspacePicture: '',
  maxWindowCount: 0,
})
const workspaceFormRef = ref<InstanceType<typeof WorkspaceForm>>()

const workspaceGroup = computed(() => {
  return Object.groupBy(workspaceList.value, ({ role }) => {
    return role === Role.OWNER ? 'owner' : 'member'
  })
})

function showFirstCreateTipsDialog() {
  const { promise, resolve } = Promise.withResolvers<void>()

  const hideFn = () => {
    dialogInstance.handleCancel()
    API.limit.userMdfWorkspaceTipInfoList()
    userStore.userInfo.firstCreateTip = false
    resolve()
  }

  const dialogInstance = showModal({
    class: 'w-[480px]',
    slots: {
      container: ( ) => <WorkspaceGuide hide-fn={hideFn} />,
    },
  })
  return promise
}

async function showCreateWorkspaceDialog() {
  const { maxWorkspaceCount, useWorkspaceCount } = userPayInfo.value

  if (useWorkspaceCount >= maxWorkspaceCount) {
    handleBusinessCode(BUSINESS_CODE.WORKSPACE_MAX_LIMIT)
    return
  }

  if (userStore.userInfo.firstCreateTip) {
   await showFirstCreateTipsDialog()
  }

  const resetWorkspaceForm = () => {
    workspaceForm.value.workspaceName = ''
    workspaceForm.value.workspacePicture = ''
    workspaceForm.value.maxWindowCount = 0
  }

  return showWorkspaceFormDialog({
    header: $t('创建新的工作空间'),
    class: 'w-[500px]',
    slots: {
      default: () => <WorkspaceForm ref={workspaceFormRef} v-model:workspaceInfo={workspaceForm.value}  />,
    },
    handleCancel: resetWorkspaceForm,
    async handleOk() {
      workspaceFormRef.value?.onInput()
      if (workspaceFormRef.value?.errorMessage) {
        return Promise.reject(new Error('表单校验失败'))
      }
      Reflect.deleteProperty(workspaceForm.value, 'maxWindowCount')
      const { code, data, msg } = await API.limit.userAddWorkspaceInfoCreate(workspaceForm.value)
      if (code === 0) {
        // toast.add({ severity: 'success', summary: $t('操作成功'), detail: $t('创建成功') })
        userStore.fetchUserInfo()
        resetWorkspaceForm()
        await workspaceStore.getWorkspaceList()
        workspaceStore.setCurrentWorkspace(data?.workspaceId)
      } else {
       await handleBusinessCode(code, () => {
          toast.add({ severity: 'error', summary: $t('发生错误'), detail: msg, life: 3000 })
          return Promise.reject(new Error(msg))
        })
      }
    },
  })
}
</script>

<template>
  <div class="workspace-manager-dialog">
    <div class="title">
      {{ $t('我的工作空间') }}
    </div>
    <div class="description">
      {{ $t('* 您在 Roxy 中的权益(如窗口用量，成员额度等)，于自己创建的工作空间内共用。') }}
    </div>
    <WorkspaceList :list="workspaceGroup.owner" @enterWorkspace="hideFn" />
    <RxButton severity="secondary" outlined class="w-full" size="md" @click="showCreateWorkspaceDialog">
      <RxSvgIcon name="base/rx_ic_plus" :size="16" />
      {{ $t('创建工作空间') }}
    </RxButton>

    <div class="title mt-[48px]">
      {{ $t('加入的工作空间') }}
    </div>
    <div class="description">
      {{ $t('* 您加入工作空间中的权益(如:窗口用量，成员额度等)，取决于空间拥有者的权益。') }}
    </div>
    <WorkspaceList :list="workspaceGroup.member" type="member" @enterWorkspace="hideFn" />
  </div>
</template>

<style lang="scss" scoped>
.workspace-manager-dialog {
  padding-top: 12px;

  .title {
    color: var(--colors-text-text-primary, #FAFAFA);
    font-family: Inter;
    font-size: 16px;
    font-style: normal;
    font-weight: 600;
    line-height: normal;
  }

  .description {
    margin-top: 6px;
    color: var(--colors-text-text-secondary, #B2B6B8);
    font-family: Inter;
    font-size: 14px;
    font-style: normal;
    font-weight: 400;
    line-height: normal;
  }

}
</style>
