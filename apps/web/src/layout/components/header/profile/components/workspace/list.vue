<script setup lang="tsx">
import Badges from '/@/layout/components/header/profile/components/badges.vue'
import WorkspaceForm from '/@/layout/components/header/profile/components/workspace/form.vue'
import WorkspaceGuide from '/@/layout/components/header/components/workspace-guide.vue'
import RxTooltip from '/@/components/rx-tooltip'
import { RxSvgIcon } from '/@/components/rx-icon'
import { useUserStore } from '/@/stores/user'
import { useWorkspaceStore } from '/@/stores/workspace'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { useHandleBusinessCode } from '/@/hooks/useResponseToast/handleBusinessCode'
import { BUSINESS_CODE } from '/@/constants/business-code'
import { useDialog } from '/@/hooks/useDialog'
import { getRoleLabelMap, Role, WorkspaceType } from '/@/enums'
import { copyText, sleep } from '/@/utils/'
import { getWorkspaceAvatarProps } from '/@/utils/workspace'
import { API } from '/@/api'
import type { UnwrapRowType, UserGetWorkspaceListListData } from '@roxy/backend-api'
import { useProjectEntityLabels } from '/@/composables/useProjectEntityLabels'

type Data = UnwrapRowType<UserGetWorkspaceListListData>

const emit = defineEmits(['hide'])

const router = useRouter()
const userStore = useUserStore()
const { getUserContact } = useUserStore()
const { workspaceList, currentWorkspace } = storeToRefs(useWorkspaceStore())
const { setCurrentWorkspace, getWorkspaceList } = useWorkspaceStore()
const { handleBusinessCode } = useHandleBusinessCode()
const [showToast, onlyErrorToast] = useResponseToast()
const [showModal] = useDialog()
const [showWorkspaceFormDialog] = useDialog()
const projectLabels = useProjectEntityLabels()

const roleStr = getRoleLabelMap()
const workspaceForm = ref({
  workspaceName: '',
  workspacePicture: '',
  maxWindowCount: 0,
})
const workspaceFormRef = ref<InstanceType<typeof WorkspaceForm>>()

const list = computed(() => {
  const { owner, member } = Object.groupBy(workspaceList.value, ({ role, workspaceType }) => {
    return role === Role.OWNER ? 'owner' : workspaceType === WorkspaceType.Public ? 'shared' : 'member'
  })
  return [...(owner || []), ...(member || [])]
})

function getAvatarProps(item: Data) {
  return getWorkspaceAvatarProps({
    workspacePicture: item.workspacePicture,
    workspaceName: item.workspaceName,
    size: 20,
    emojiFontSize: 12,
    textFontSize: 10,
  })
}

async function _copyUserInfo() {
  const { email, phone } = await getUserContact()
  copyText(email || phone || '')
  showToast(0, $t('复制成功'))
}

async function enterWorkspace(item: Data) {
  if (item.id === currentWorkspace.value?.id)
    return

  item.id && setCurrentWorkspace(item.id)
  globalThis.electronAPI.send('mcp:close')
  emit('hide')
}

async function showCreateWorkspaceDialog() {
  const { maxWorkspaceCount, useWorkspaceCount } = userStore.userPayInfo

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
    header: $t('创建新的团队'),
    class: 'w-[500px]',
    slots: {
      header: () => (
        <div class="flex items-center justify-between gap-1">
          <span class="tt-primary text-4 font-600">{$t('创建新的团队')}</span>

          <RxTooltip class="flex items-center">
            {{
              default: () => <RxSvgIcon class="cursor-pointer" name="base/rx_ic_info" size="14" color="var(--colors-icon-icon-tertiary)" />,
              content: () => <div class="color-white w-60 whitespace-pre-wrap text-3">{projectLabels.value.teamIsolationDescription}</div>,
            }}
          </RxTooltip>

        </div>
      ),
      default: () => (
        <WorkspaceForm
          ref={workspaceFormRef}
          workspaceInfo={workspaceForm.value as UnwrapRowType<UserGetWorkspaceListListData>}
          onUpdate:workspaceInfo={v => Object.assign(workspaceForm.value, v)}
        />
      ),
    },
    handleCancel: resetWorkspaceForm,
    async handleOk() {
      workspaceFormRef.value?.onInput()
      if (workspaceFormRef.value?.errorMessage) {
        return Promise.reject(new Error('表单校验失败'))
      }
      Reflect.deleteProperty(workspaceForm.value, 'maxWindowCount')
      const { code, data, msg } = await API.limit.userAddWorkspaceInfoCreate({
        ...workspaceForm.value,
        workspaceType: currentWorkspace.value?.workspaceType,
      })
      if (code === 0) {
        userStore.fetchUserInfo()
        resetWorkspaceForm()
        await getWorkspaceList()
        setCurrentWorkspace(data.workspaceId)
        sleep(600).then(() => {
          router.replace({ name: 'home' })
        })
      }
      else {
        await handleBusinessCode(code, () => {
          onlyErrorToast(code, msg)
          return Promise.reject(new Error(msg))
        })
      }
    },
  })
}

function showFirstCreateTipsDialog() {
  const { promise, resolve } = Promise.withResolvers<void>()

  const dialogInstance = showModal({
    class: 'w-120',
    slots: {
      container: () => (
        <WorkspaceGuide hide-fn={() => {
          dialogInstance.handleCancel()
          API.limit.userMdfWorkspaceTipInfoList()
          Reflect.set(userStore.userInfo, 'firstCreateTip', false)
          resolve()
        }}
        />
      ),
    },
  })
  return promise
}
</script>

<template>
  <div class="flex flex-col gap-2 py-2 pl-1.5 ">
    <div class="flex flex-col gap-1 w-full">
      <div class="flex items-center gap-2.5">
        <div class="tt-primary text-3.25 leading-4 ellipsis-1">
          {{ userStore.userInfo.userName }}
        </div>
        <Badges />
      </div>
    </div>
    <div class="flex flex-col gap-1 pr-1.5 max-h-40 overflow-y-auto">
      <div v-for="item in list" :key="item.id" class="shrink-0 h-7 flex items-center gap-1.5 pl-1 cursor-pointer select-none item" @click="enterWorkspace(item)">
        <RxAvatar v-bind="getAvatarProps(item)" />
        <div class="flex gap-1 flex-1 items-center overflow-hidden">
          <div class="tt-primary text-3 font-500 ellipsis-1">
            {{ item.workspaceName }}
          </div>
          <div v-if="item.workspaceDefault && item.role === Role.OWNER" class="shrink-0 py-0.5 px-1 tt-brand text-2.75 font-600 rounded-1 tag">
            {{ $t('默认') }}
          </div>
          <div v-if="item.role !== Role.OWNER" class="shrink-0 py-0.5 px-1 tt-tertiary text-2.75 font-600 rounded-1 bg-[var(--colors-background-bg-action-inactive)]">
            {{ roleStr[item.role as keyof typeof roleStr] }}
          </div>
        </div>
        <SvgIcon v-if="currentWorkspace!.id === item.id" class="mr-1 shrink-0" name="base/rx_ic_check" size="14" color="var(--colors-icon-icon-secondary)" />
      </div>
    </div>
    <div class="h-7 -my-1 flex items-center gap-1.5 pl-1 cursor-pointer item" @click="showCreateWorkspaceDialog">
      <SvgIcon class="tt-brand" name="base/rx_ic_plus" />
      <div class="tt-brand text-3 leading-4">
        {{ $t('创建团队') }}
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.item {
  border-radius: var(--tieredmenu-item-border-radius);
  transition:
    background var(--tieredmenu-transition-duration),
    color var(--tieredmenu-transition-duration);

  &:hover {
    background-color: var(--tieredmenu-item-focus-background);
  }
}

.tag {
  background-color: rgba(17, 163, 253, 0.2);
}
</style>
