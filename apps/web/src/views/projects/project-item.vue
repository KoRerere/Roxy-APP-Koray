<script setup lang="ts">
import { RxSvgIcon } from '/@/components/rx-icon/'
import { useRoleStore } from '/@/stores/role'
import Profiles from '/@/views/browser/list/profiles/index.vue'
import MemberDropdownList from '/@/views/projects/components/member-dropdown-list.vue'
import { useInviteUserFormDialog } from './hooks/useInviteUserFormDialog'

const role = useRoleStore()
const route = useRoute()
const router = useRouter()
const [showInviteUserFormDialog] = useInviteUserFormDialog()
const profilesRef = useTemplateRef('profiles')
const projectId = Number(route.params.id)
console.log('route', route)
function handleShowInviteUserFormDialog() {
  showInviteUserFormDialog({
    tableRef: profilesRef.value?.tableRef,
    projectIds: [projectId],
    disableds: ['projectIds'],
  })
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
          {{ route.query.title }}
        </div>
      </template>
      <MemberDropdownList :project-id="projectId" />
      <RxButton v-if="!role.isViewer" severity="secondary" outlined size="xxs" icon="base/rx_ic_user_add" :label="$t('邀请')" @click="handleShowInviteUserFormDialog" />
    </ViewsHeader>
    <!-- eslint-disable-next-line vue/no-unused-refs -->
    <Profiles ref="profiles" is-project-profile />
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
