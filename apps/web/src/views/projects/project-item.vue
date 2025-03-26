<script setup lang="ts">
import { RxSvgIcon } from '/@/components/rx-icon/'
import { ProjectPin } from '/@/enums'
import { useProjectStore } from '/@/stores/project'
import { useRoleStore } from '/@/stores/role'
import Profiles from '/@/views/browser/list/profiles/index.vue'
import MemberDropdownList from '/@/views/projects/components/member-dropdown-list.vue'
import { useProjectActions } from '/@/views/projects/hooks/useProject'
import { useInviteUserFormDialog } from './hooks/useInviteUserFormDialog'
import { useHandleBusinessCode } from '/@/hooks/useResponseToast/handleBusinessCode'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { API } from '/@/api'

const role = useRoleStore()
const route = useRoute()
const router = useRouter()
const { getProjects } = useProjectStore()
const [showInviteUserFormDialog] = useInviteUserFormDialog()
const [projectModfiyDialog] = useProjectActions()
const profilesRef = useTemplateRef('profiles')
const { handleBusinessCode } = useHandleBusinessCode()
const [showToast, onlyErrorToast] = useResponseToast()

const projectId = ref(Number(route.params.id))
const projectName = ref(route.query.title)

watch(() => route.params.id, (value) => {
  projectId.value = Number(value)
  projectName.value = route.query.title
})

function handleShowInviteUserFormDialog() {
  showInviteUserFormDialog({
    tableRef: profilesRef.value?.tableRef as any,
    projectIds: [projectId.value],
    disableds: ['projectIds'],
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
      <MemberDropdownList :project-id="projectId" />
      <RxButton v-if="!role.isViewer" severity="secondary" outlined size="xxs" icon="base/rx_ic_user_add"
        :label="$t('邀请')" @click="handleShowInviteUserFormDialog" />
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
  color: var(--Colors-Text-text-secondary, #575d61);
  border-bottom: 0.5px solid var(--Colors-Border-border-container, #c7cdd1);

  &-title {
    &:hover {
      color: var(--Colors-Text-text-brand, #12a3fc);
    }
  }

  &-subproject {
    color: var(--Colors-Text-text-primary, #171c1f);
  }
}
</style>
