<script setup lang="tsx">
import Profiles from '/@/views/browser/list/profiles/index.vue'
import MemberDropdownList from '/@/views/projects/components/member-dropdown-list.vue'
import InviteUserModal from '/@/views/projects/components/invite-user-modal.vue'
import { RxSvgIcon } from '/@/components/rx-icon/'
import { ProjectPin } from '/@/enums'
import { useProjectStore } from '/@/stores/project'
import { useRoleStore } from '/@/stores/role'
import { useProjectActions } from '/@/views/projects/hooks/useProject'
import { API } from '/@/api'
import { useTeam } from '/@/views/team/hooks'
import { useDialog } from '/@/hooks/useDialog'
import { emitter } from '/@/utils/eventBus'

const role = useRoleStore()
const route = useRoute()
const router = useRouter()
const [showModal] = useDialog()
const [projectModfiyDialog] = useProjectActions()
const { getProjects } = useProjectStore()
const { getTeamMembers } = useTeam()

const projectRef = useTemplateRef('project')
const projectId = ref(Number(route.params.id))
const projectName = ref(route.query.title)
const members = ref()

watch(() => route.params.id, (value) => {
  projectId.value = Number(value)
  projectName.value = route.query.title
  getMemberByCurrentProject()
})

onMounted(() => {
  getMemberByCurrentProject()
  emitter.on('updateProjectList', () => {
    projectRef.value?.tableRef?.refresh()
  })
})

async function getMemberByCurrentProject() {
  const { code, data } = await API.limit.userGetMemberInfoByProjectIdList({
    projectId: projectId.value,
    type: 'show_list',
  })
  if (code === 0) {
    members.value = data.rows
  }
}

async function handleShowDialog() {
  const { data: { rows } } = await getTeamMembers()

  showModal({
    showHeader: false,
    modal: true,
    blockScroll: true,
    pt: {
      content: '!pa-0',
    },
    slots: {
      container: ({ hideModal }) => (
        <InviteUserModal
          v-model:currentMembers={members.value}
          allMembers={rows}
          project={{
            projectName: projectName.value,
            projectId: projectId.value,
          }}
          onClose={hideModal}
        />
      ),
    },
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
</script>

<template>
  <div class="flex flex-col h-full w-full">
    <ViewsHeader>
      <template #title>
        <div class="cursor-pointer title" @click="() => router.replace({ name: 'projects' })">
          {{ $t('项目管理') }}
        </div>
      </template>
      <template #title-after>
        <RxSvgIcon name="base/rx_ic_play" :size="8" />
        <div class="subproject">
          {{ projectName }}
        </div>
        <RxSvgIcon v-if="role.isOwner || role.isManager" class="cursor-pointer" name="base/rx_ic_edit" color="var(--colors-text-text-secondary)" @click="editProject" />
      </template>
      <MemberDropdownList :members="members" />
      <RxButton v-if="!role.isViewer" severity="secondary" outlined size="xxs" icon="base/rx_ic_user_add" :label="$t('邀请')" @click="handleShowDialog" />
    </ViewsHeader>
    <div class="flex-1 overflow-hidden">
      <Profiles ref="project" is-project-profile />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.title {
  color: var(--colors-text-text-secondary);

  &:hover {
    color: var(--colors-text-text-brand);
  }
}

.subproject {
  color: var(--colors-text-text-primary);
}
</style>
