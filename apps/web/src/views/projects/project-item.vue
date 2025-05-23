<script setup lang="tsx">
import Profiles from '/@/views/browser/list/profiles/index.vue'
import MemberDropdownList from '/@/views/projects/components/member-dropdown-list.vue'
import InviteUserModal from '/@/views/projects/components/invite-user-modal.vue'
import { RxSvgIcon } from '/@/components/rx-icon/'
import { ProjectPin } from '/@/enums'
import { useProjectStore } from '/@/stores/project'
import { useRoleStore } from '/@/stores/role'
import { useProjectActions } from '/@/views/projects/hooks/useProject'
import { useHandleBusinessCode } from '/@/hooks/useResponseToast/handleBusinessCode'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { API } from '/@/api'
import { useDialog } from '/@/hooks/useDialog'

const role = useRoleStore()
const route = useRoute()
const router = useRouter()
const { getProjects } = useProjectStore()
const [showModal] = useDialog()
const [projectModfiyDialog] = useProjectActions()
const { handleBusinessCode } = useHandleBusinessCode()
const [showToast] = useResponseToast()

const projectId = ref(Number(route.params.id))
const projectName = ref(route.query.title)
const members = ref()
const allMembers = ref()

watch(() => route.params.id, (value) => {
  projectId.value = Number(value)
  projectName.value = route.query.title
  getMemberByCurrentProject()
})

onBeforeMount(() => {
  getMemberByCurrentProject()
  getMemberByCurrentWorkspace()
})

async function getMemberByCurrentProject() {
  const { code, data } = await API.limit.userGetMemberInfoByProjectIdList({
    projectId: projectId.value,
    type: 'show_list'
  })
  if (code === 0) {
    members.value = data.rows
  }
}

async function getMemberByCurrentWorkspace() {
  const { code, data } = await API.team.userGetMemberInfoByWorkspaceList({})
  if (code === 0) {
    allMembers.value = data.rows
  }
}

function handleShowDialog() {
  showModal({
    showHeader: false,
    modal: true,
    blockScroll: true,
    pt: {
      content: '!pa-0'
    },
    slots: {
      container: ({ hideModal }) => <InviteUserModal
        v-model:currentMembers={members.value}
        allMembers={allMembers.value}
        project={{
          projectName: projectName.value,
          projectId: projectId.value,
        }}
        onClose={hideModal}
      />
    }
  })
}

function editProject() {
  projectModfiyDialog({
    pinStatus: ProjectPin.pinned,
    projectName: projectName.value,
    project_id: projectId.value,
    confirmNext: async ({ params }: any) => {
      await getProjects()
      projectName.value = params.projectName
    },
  })
}

async function toCreateBrowser() {
  const { code, msg } = await API.window.userCheckWindowTotalCountList()
  if (code === 0) {
    router.push({ name: 'browser-create', query: { projectId: projectId.value } })
  } else {
    handleBusinessCode(code, () => {
      showToast(code, msg)
    })
  }
}
</script>

<template>
  <div class="flex flex-col h-full w-full">
    <ViewsHeader class="project-header">
      <template #title>
        <div class="project-header-title cursor-pointer" @click="() => router.push({ name: 'projects' })">
          {{ $t('项目管理') }}
        </div>
      </template>
      <template #title-after>
        <RxSvgIcon name="base/rx_ic_play" :size="8" />
        <div class="project-header-subproject">
          {{ projectName }}
        </div>
        <RxSvgIcon v-if="role.isOwner || role.isManager" name="base/rx_ic_edit" class="cursor-pointer"
          @click="editProject" />
      </template>
      <MemberDropdownList :members="members" />
      <RxButton v-if="!role.isViewer" severity="secondary" outlined size="xxs" icon="base/rx_ic_user_add"
        :label="$t('邀请')" @click="handleShowDialog" />
      <RxButton v-if="!role.isViewer" size="xxs" icon="base/rx_ic_browser_add" :label="$t('创建窗口')"
        @click="toCreateBrowser" />
    </ViewsHeader>
    <!-- eslint-disable-next-line vue/no-unused-refs -->
    <div class="flex-1 overflow-hidden">
      <Profiles ref="profiles" is-project-profile />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.project-header {
  color: var(--colors-text-text-secondary, #b2b6b8);
  border-bottom: 0.5px solid var(--colors-border-border-base, #c7cdd1);

  &-title {
    &:hover {
      color: var(--colors-text-text-brand, #12a3fc);
    }
  }

  &-subproject {
    color: var(--colors-text-text-primary, #fafafa);
  }
}
</style>
