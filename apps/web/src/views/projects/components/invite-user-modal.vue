<script setup lang="ts">
import EmailInput from '/@/views/projects/components/email-input.vue'
import RoleSplit from './role-split.vue'
import TsFormMultiSelect from '/@/views/lab/components/form/m-input-multi-select.vue'
import MemberInfo from '/@/views/team/components/member-info.vue'
import { API } from '/@/api'
import { useUserStore } from '/@/stores/user'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { useHandleBusinessCode } from '/@/hooks/useResponseToast/handleBusinessCode'
import { getRoleLabelMap, Role } from '/@/enums/'
import { validatePhone } from '/@/utils'

interface Props {
  project?: Record<string, any>
  projects?: any[]
  projectValues?: number[]
  allMembers?: any[]
  onlyInvite?: boolean
  inviteRole?: Role
  onBeforeClose?: (refresh?: boolean) => void
}

const {
  project,
  projects,
  projectValues,
  allMembers = [],
  onlyInvite = false,
  inviteRole = Role.VIEWER,
  onBeforeClose,
} = defineProps<Props>()

defineEmits(['close'])

const roleLabelMap = getRoleLabelMap()
const [showToast] = useResponseToast()
const { handleBusinessCode } = useHandleBusinessCode()
const { mixpanelTrack } = useUserStore()

const currentMembers = defineModel<any[]>('currentMembers', { default: [] })

const needRefresh = ref(false)
const roleValue = ref(inviteRole)
const selectedProjects = ref(projectValues)
const emails = ref<any[]>([])

onBeforeMount(() => {
  mixpanelTrack('teammate_invite_open')
})

onBeforeUnmount(() => {
  onBeforeClose?.(needRefresh.value)
})

async function inviteNewMember() {
  if (onlyInvite && !selectedProjects.value?.length) {
    showToast(-1, $t('请选择至少一个项目'))
    return
  }

  const emailList = emails.value.filter(item => !item.invalid && !currentMembers.value.some(member => member.email === item.value || member.phone === item.value)).map(item => item.value)
  if (!emailList.length) {
    showToast(-1, $t('请至少输入一个有效的邮箱/手机号'))
    return
  }

  const projectIds = (selectedProjects.value ?? []).concat(project?.projectId).filter(Boolean)
  const { code, msg } = await API.limit.userBatchInviteCreate({
    inviteType: 'project',
    emailList,
    role: roleValue.value,
    projectIds,
  })

  handleBusinessCode(code, () => {
    if (code === 0) {
      showToast(code, $t('邀请已发送'))
    }
    else {
      showToast(code, msg)
    }
  })
  if (code !== 0)
    return
  updateCurrentMembers(emailList)
}

function updateCurrentMembers(emailList: string[]) {
  const newMembers = emailList.map((str) => {
    const member = allMembers.find(item => item.email === str || item.phone === str)
    if (member)
      return { ...member }
    return {
      userName: '--',
      role: roleValue.value,
      avatarColor: '#FF9191',
      ...(validatePhone(str) ? { phone: str, email: '' } : { phone: '', email: str }),
    }
  })

  emails.value = []
  currentMembers.value.push(...newMembers)
  needRefresh.value = true
}
</script>

<template>
  <div class="flex flex-col pa-6 pt-4 gap-6 max-h-[80vh] overflow-y-auto w-120">
    <div class="flex justify-between items-center">
      <span class="header">{{ $t('邀请用户加入{project}', { project: project?.projectName }) }}</span>
      <SvgIcon class="cursor-pointer" name="base/rx_ic_delete" size="20" color="var(--colors-icon-icon-secondary, #575D60)" @click="$emit('close')" />
    </div>
    <template v-if="projects?.length && roleValue !== Role.MANAGER">
      <div class="flex flex-col gap-2">
        <div class="title">
          {{ $t('选择项目') }}
        </div>
        <TsFormMultiSelect v-model="selectedProjects" :options="projects" :placeholder="$t('请选择项目')" display="chip" size="md" option-value="value" />
      </div>
      <div class="separator" />
    </template>

    <div class="flex flex-col gap-2">
      <div class="flex items-center gap-1">
        <span class="title">{{ $t('成员邮箱/手机号') }}</span>
        <SvgIcon v-tooltip.top="$t('被邀请的用户若已在其他项目中，将不会修改身份')" name="base/rx_ic_info" size="16" color="var(--colors-icon-icon-note)" />
      </div>
      <div class="w-full flex items-start gap-2">
        <div class="flex-1 flex items-start py-1 pr-1 content">
          <EmailInput v-model="emails" class="min-h-8.25 flex-1 !py-0 !border-none " />
          <RoleSplit v-model="roleValue" />
        </div>
        <RxButton class="mt-0.25" size="lg" :label="$t('邀请')" @click="inviteNewMember" />
      </div>
    </div>

    <div v-if="!onlyInvite && currentMembers?.length" class="flex flex-col gap-2">
      <div class="title">
        {{ $t('当前项目成员列表') }}
      </div>
      <div class="member-list">
        <div v-for="item in currentMembers" :key="item.id" class="flex items-center gap-2 member-item">
          <MemberInfo class="flex-1" :avatar="item.avatar" :user-name="item.userName" :avatar-color="item.avatarColor" :email="item.email" :phone="item.phone" />
          <RxTag disabled :label="roleLabelMap[item.role as keyof typeof roleLabelMap]" />
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
:deep(.p-inputtext) {
  padding-right: 100px !important;
}

.header {
  color: var(--colors-text-text-primary);
  font-size: 16px;
  font-weight: 600;
  line-height: normal;
}

.title {
  color: var(--colors-text-text-primary);
  font-size: 14px;
  font-weight: 500;
  line-height: 16px;
}

.separator {
  background: var(--colors-border-divider);
  height: 1px;
  width: 100%;
}

.member {
  &-item {
    height: 52px;
    border-bottom: 0.5px solid var(--colors-border-divider);

    &:last-of-type {
      border-bottom: none;
    }
  }
}

.content {
  border-radius: 6px;
  border: 1px solid var(--colors-border-border-action);
  background: var(--colors-background-bg-action);
}
</style>
