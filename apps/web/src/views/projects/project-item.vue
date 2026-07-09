<script setup lang="tsx">
import Profiles from '/@/views/browser/list/profiles/index.vue'
import MemberDropdownList from '/@/views/projects/components/member-dropdown-list.vue'
import InviteUserModal from '/@/views/projects/components/invite-user-modal.vue'
import { ProjectPin } from '/@/enums'
import { useProjectStore } from '/@/stores/project'
import { useProjectActions } from '/@/views/projects/hooks/useProject'
import { API } from '/@/api'
import { useTeamStore } from '/@/stores/team'
import { usePermission } from '/@/hooks/usePermission'
import { useDialog } from '/@/hooks/useDialog'
import { useEmitterEvent } from '/@/utils/eventBus'
import { LIST_CACHE_NAMESPACE, useListCacheActions } from '/@/stores/listCache'

const route = useRoute()
const router = useRouter()
const [showModal] = useDialog()
const [projectModfiyDialog] = useProjectActions()
const { getProjects } = useProjectStore()
const { getTeamMembers } = useTeamStore()
const { check } = usePermission()
const { invalidateCache: invalidateListCache } = useListCacheActions()

const projectRef = useTemplateRef('project')
const projectId = ref(Number(route.params.id))
const projectName = ref(route.query.title)
const members = ref()

function invalidateCurrentProjectProfilesCache() {
  invalidateListCache(LIST_CACHE_NAMESPACE.BROWSER_LIST, {
    projectId: String(projectId.value),
  })
}

function refreshProjectProfiles() {
  invalidateCurrentProjectProfilesCache()
  projectRef.value?.tableRef?.refresh()
}

watch(() => route.params.id, (value) => {
  projectId.value = Number(value)
  projectName.value = route.query.title
  getMemberByCurrentProject()
})

useEmitterEvent('updateProjectList', () => {
  refreshProjectProfiles()
})

onMounted(() => {
  getMemberByCurrentProject()
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
        <SvgIcon name="base/rx_ic_play" :size="8" />
        <div class="subproject">
          {{ projectName }}
        </div>
        <SvgIcon v-if="check('Projects_edit')" class="cursor-pointer" name="base/rx_ic_edit" color="var(--colors-text-text-secondary)" @click="editProject" />
      </template>
      <MemberDropdownList v-if="check('Team_Member_view_page')" :members="members" />
      <RxButton v-if="check('Team_Member_invite')" severity="secondary" outlined size="xxs" icon="base/rx_ic_user_add" :label="$t('邀请')" @click="handleShowDialog" />
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
