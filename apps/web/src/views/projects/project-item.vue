<script setup lang="ts">
import { useRoute } from 'vue-router'
import { RxSvgIcon } from '/@/components/rx-icon/'
import { useRoleStore } from '/@/stores/role'
import Profiles from '/@/views/browser/list/profiles/index.vue'
import MemberDropdownList from '/@/views/projects/components/member-dropdown-list.vue'
import { useInviteUserFormDialog } from './hooks/useInviteUserFormDialog'

const role = useRoleStore()
const route = useRoute()
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
    <div class="project-header">
      <div class="flex items-center gap-2">
        <div class="project-header-project">
          {{ $t('项目') }}
        </div>
        <RxSvgIcon name="base/rx_ic_play" :size="8" />
        <div class="project-header-subproject">
          {{ route.query.title }}
        </div>
      </div>
      <div class="flex gap-3">
        <MemberDropdownList :project-id="projectId" />
        <RxButton v-if="!role.isViewer" severity="secondary" outlined size="sm" icon="base/rx_ic_user_add" :label="$t('邀请')" @click="handleShowInviteUserFormDialog" />
      </div>
    </div>
    <!-- eslint-disable-next-line vue/no-unused-refs -->
    <Profiles ref="profiles" is-project-profile />
  </div>
</template>

<style lang="scss" scoped>
.project-header {
  display: flex;
  padding: var(--spacing-xl, 12px) var(--spacing-4xl, 24px);
  justify-content: space-between;
  align-items: center;
  border-bottom: 0.5px solid var(--Colors-Border-border-container, #c7cdd1);

  font-family: Inter;
  font-size: 16px;
  font-weight: 600;
  line-height: normal;

  &-project {
    color: var(--Colors-Text-text-secondary, #575d61);
  }

  &-subproject {
    color: var(--Colors-Text-text-primary, #171c1f);
  }
}
</style>
