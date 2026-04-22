<script setup lang="ts">
import RolesDetail from '/@/views/team/components/roles-detail.vue'
import { useUserStore } from '/@/stores/user'
import { useRoleStore } from '/@/stores/role'
import { useTeamStore } from '/@/stores/team'
import { useTeam } from '/@/views/team/hook'
import { useDialog } from '/@/hooks/useDialog'
import { getRoleLabelMap, Role } from '/@/enums'
import { emitter } from '/@/utils/eventBus'

const route = useRoute()
const { isOwner } = storeToRefs(useRoleStore())
const { members } = storeToRefs(useTeamStore())
const { userPayInfo } = storeToRefs(useUserStore())
const [showModal] = useDialog()
const { inviteMembers } = useTeam()

const roleStr = getRoleLabelMap()
const roles = computed(() => {
  const result = members.value.reduce((acc, item: any) => {
    const data = {
      avatar: item.avatar,
      name: item.userName?.slice(0, 2),
      color: item.avatarColor,
    }

    if (item.role === Role.MANAGER) {
      acc.manager.push(data)
    }
    else if (item.role === Role.EDITOR) {
      acc.editor.push(data)
    }
    else if (item.role === Role.VIEWER) {
      acc.viewer.push(data)
    }
    return acc
  }, { manager: [], editor: [], viewer: [] } as Record<string, any[]>)

  return [
    {
      value: Role.MANAGER,
      role: roleStr[Role.MANAGER],
      members: result.manager,
      desc: $t('可以管理所有窗口，编辑所有查看者和编辑者权限'),
    },
    {
      value: Role.EDITOR,
      role: roleStr[Role.EDITOR],
      members: result.editor,
      desc: $t('可以管理所有窗口，编辑所有查看者权限'),
    },
    {
      value: Role.VIEWER,
      role: roleStr[Role.VIEWER],
      members: result.viewer,
      desc: $t('只能打开或查看权限内的窗口信息'),
    },
  ]
})

const visible = computed(() => {
  return isOwner.value && route.name === 'teams'
})

function _inviteMembers() {
  inviteMembers({
    onBeforeClose: (refresh) => {
      if (refresh) {
        emitter.emit('updateTeamMemberList')
      }
    },
  })
}

function openRoleSettings(item: any) {
  showModal({
    showHeader: false,
    modal: true,
    blockScroll: true,
    slots: {
      container: ({ hideModal }) => h(RolesDetail, {
        role: item.value,
        readonly: true,
        onClose: hideModal,
        title: $t('{role} - 权限详情', { role: item.role }),
      }),
    },
  })
}
</script>

<template>
  <div v-if="visible" class="grid grid-cols-4 gap-3 pb-3 mr-4">
    <div class="relative overflow-hidden rounded-1 team">
      <div class="relative w-full h-full flex flex-col justify-between pa-4 z-1 ">
        <div class="flex justify-between">
          <div class="team-title">
            {{ $t('我的团队') }}
          </div>
          <div class="flex items-center py-1 px-1.5 gap-1 rounded-1 cursor-pointer team-invite" @click="_inviteMembers">
            <SvgIcon name="base/rx_ic_user_add" size="12" />
            <span>{{ $t('邀请') }}</span>
          </div>
        </div>

        <div class="flex items-baseline gap-1">
          <span class=" shrink-0 team-used">{{ userPayInfo.useMemberCount }} / {{ userPayInfo.maxMemberCount }}</span>
          <span class="ml-1.5 team-text">{{ $t('团队成员') }}</span>
        </div>
      </div>
      <SvgIcon class="absolute top-2 -right-14 z-0" name="empty/rx_illustration_user" size="168" />
    </div>

    <div v-for="item in roles" :key="item.value" class="min-h-30 flex flex-col pa-4 gap-2 rounded-1 item">
      <div class="min-h-6 flex items-center justify-between">
        <div class="item-role">
          {{ item.role }}
        </div>
        <RxAvatar :max="5" :list="item.members" :size="24" :font-size="12" :gap="-6" />
      </div>
      <div class="flex-1 overflow-hidden item-desc">
        {{ item.desc }}
      </div>
      <div class="cursor-pointer item-detail" @click="openRoleSettings(item)">
        {{ $t('权限详情') }}
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.team {
  background: linear-gradient(118deg, #11a3fd 20.99%, #fff 148.42%);

  &-title {
    color: #fff;
    font-size: 16px;
    font-weight: 700;
  }

  &-invite {
    color: #fff;
    font-size: 12px;
    background: rgba(0, 0, 0, 0.2);
  }

  &-used {
    color: #fff;
    font-size: 32px;
    font-weight: 700;
  }

  &-text {
    color: #fff;
    font-size: 20px;
    font-weight: 700;
  }
}

.item {
  border: 1px solid var(--colors-border-border-inactive);
  background: var(--colors-background-bg-overlay);

  &-role {
    color: var(--colors-text-text-primary);
    font-size: 16px;
    font-weight: 700;
    line-height: 16px;
  }

  &-desc {
    color: var(--colors-text-text-tertiary);
    font-size: 12px;
    line-height: 16px;
  }

  &-detail {
    color: var(--colors-text-text-brand);
    text-align: right;
    font-size: 12px;
    line-height: 16px;
  }
}
</style>
