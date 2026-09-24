<script lang="ts" setup>
import { useConfirm } from 'primevue/useconfirm'
import MemberInfo from '/@/views/team/components/member-info.vue'
import { RxSvgIcon } from '/@/components/rx-icon'
import { getRoleLabelMap, Role } from '/@/enums/'
import { API } from '/@/api'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { usePermission } from '/@/hooks/usePermission'
import { useWorkspaceStore } from '/@/stores/workspace'

const { projectId, projectName } = defineProps<{
  projectId?: number
  projectName?: string
}>()

const members = defineModel<any[]>('members', { default: () => [] })
const confirm = useConfirm()
const [showToast] = useResponseToast()
const { check } = usePermission()
const { currentWorkspace } = storeToRefs(useWorkspaceStore())
const roleLabelMap = getRoleLabelMap()
const opRef = useTemplateRef('op')

function toggle(event: Event) {
  opRef.value?.toggle(event)
}

/** 只能移除比自己权限低的成员 */
function isRemoveDisabled(member: { role: Role }) {
  return currentWorkspace.value!.role! <= member.role
}

function removeMember(member: any) {
  if (isRemoveDisabled(member)) {
    return
  }
  confirm.require({
    header: $t('移除成员'),
    message: $t('确认将成员{name}移出项目{projectName}?', { name: member.userName, projectName }),
    rejectProps: {
      label: $t('取消'),
      severity: 'secondary',
      outlined: true,
    },
    acceptProps: {
      label: $t('确认'),
      severity: 'danger',
    },
    accept: async () => {
      const { code, msg } = await API.team.userDelProjectMemberCreate({
        projectId: projectId!,
        userId: member.userId,
      })
      showToast(code, msg)
      if (code !== 0) {
        return
      }
      members.value = members.value.filter(item => item.userId !== member.userId)
    },
  })
}
</script>

<template>
  <div class="drop-btn" @click="toggle">
    <span class="tt-primary text-3 font-500 leading-4">{{ $t('成员') }}({{ members?.length || 0 }})</span>
    <RxSvgIcon name="base/rx_ic_chevron_down" />
  </div>

  <Popover ref="op" :pt="{ content: { class: '!pa-0' } }">
    <div class="flex flex-col gap-4 min-w-80">
      <div>
        <div class="member-list max-h-[440px] overflow-y-auto">
          <div v-for="member in members" :key="member.email" class="self-stretch flex items-center justify-between gap-1.5 py-2 pr-1.5 pl-2.5 rounded-1">
            <MemberInfo :avatar="member.avatar" :user-name="member.userName" :avatar-color="member.avatarColor" :email="member.email" :phone="member.phone">
              <template #name>
                <div class="flex items-center gap-2">
                  <div class="ellipsis-1 tt-primary text-3.25 leading-4 font-500">
                    {{ member.userName }}
                  </div>
                  <div class="shrink-0 role">
                    {{ roleLabelMap[member.role as keyof typeof roleLabelMap] }}
                  </div>
                </div>
              </template>
            </MemberInfo>
            <RxButton v-if="projectId && member.role !== Role.OWNER && check('Team_Member_delete')" v-tooltip.top="isRemoveDisabled(member) ? $t('权限不足') : ''" variant="text" severity="danger"
                      size="xxs" :label="$t('移除')" :disabled="isRemoveDisabled(member)" @click="removeMember(member)"
            />
          </div>
        </div>
      </div>
    </div>
    <div class="manage-users">
      <RouterLink :to="{ name: 'teams' }" @click.stop.prevent>
        {{ $t('管理成员') }}
      </RouterLink>
    </div>
  </Popover>
</template>

<style lang="scss" scoped>
.drop-btn {
  display: flex;
  min-width: 24px;
  padding: var(--spacing-sm, 4px) var(--spacing-md, 6px);
  justify-content: center;
  align-items: center;
  gap: var(--spacing-sm, 4px);
  cursor: pointer;
}

.manage-users {
  display: flex;
  padding: 10px var(--spacing-md, 6px) 10px 10px;
  justify-content: center;
  align-items: center;
  gap: var(--spacing-md, 6px);
  align-self: stretch;
  border-radius: var(--radius-sm, 4px);
  color: var(--colors-text-text-brand, #12a3fc);
  text-align: center;
  font-family: Inter;
  font-size: 13px;
  font-style: normal;
  font-weight: 400;
  line-height: var(--Line-Height-text-xs, 16px);
  /* 123.077% */
}

.member-list {
  display: flex;
  padding: var(--spacing-sm, 4px);
  flex-direction: column;
  align-items: flex-start;
  gap: var(--spacing-none, 0px);
  align-self: stretch;
  border-bottom: 0.5px solid var(--component-dropdown-divider);
}

.role {
  display: flex;
  padding: 2px 6px;
  justify-content: center;
  align-items: center;
  color: var(--colors-text-text-inactive, #7d8387);
  font-family: 'DingTalk JinBuTi';
  font-size: 11px;
  line-height: normal;
  border-radius: var(--radius-full, 9999px);
  background:
    linear-gradient(
      0deg,
      var(--component-checker-bg-inactive, #e2e9ee) 0%,
      var(--component-checker-bg-inactive, #e2e9ee) 100%
    ),
    linear-gradient(126deg, #f6d56c 22.24%, #edb51d 49.77%);
}
</style>
