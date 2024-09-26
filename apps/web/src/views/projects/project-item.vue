<script setup lang="ts">
import { useRoute } from 'vue-router'
import { useInviteUserFormDialog } from './hooks/useInviteUserFormDialog'
import { RxSvgIcon } from '/@/components/rx-icon/'
import Profiles from '/@/views/browser/list/profiles/index.vue'

const route = useRoute()
const [showInviteUserFormDialog] = useInviteUserFormDialog()
const profilesRef = useTemplateRef('profiles')

function handleShowInviteUserFormDialog() {
  showInviteUserFormDialog({ tableRef: profilesRef.value?.tableRef })
}
</script>

<template>
  <div>
    <div class="project-header">
      <div class="flex items-center gap-2">
        <RxSvgIcon name="base/rx_ic_stack" />
        <div class="project-header-project">
          Projects
        </div>
        <RxSvgIcon name="base/rx_ic_play" :size="8" />
        <div class="project-header-subproject">
          {{ route.query.title }}
        </div>
      </div>
      <div>
        <ryButton severity="secondary" outlined size="small" icon="base/rx_ic_user_add" label="Invite"
          @click="handleShowInviteUserFormDialog" />
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
