<script setup lang="ts">
import RoleSplit from './role-split.vue'
import TsFormMultiSelect from '/@/views/lab/components/form/m-input-multi-select.vue'
import MemberInfo from '/@/views/team/components/member-info.vue'
import Fuse from 'fuse.js'
import { API } from '/@/api'
import { $t } from '/@/locales'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { useHandleBusinessCode } from '/@/hooks/useResponseToast/handleBusinessCode'
import { getRoleLabelMap, Role } from '/@/enums/'
import type { AutoCompleteCompleteEvent, AutoCompleteOptionSelectEvent } from 'primevue/autocomplete'

interface Props {
  project?: Record<string, any>
  projects?: any[]
  projectValues?: number[]
  allMembers?: any[]
  multiple?: boolean
  inviteRole?: Role
  onBeforeClose?: (refresh?: boolean) => void
}

const {
  project,
  projects,
  projectValues,
  allMembers = [],
  multiple = false,
  inviteRole = Role.VIEWER,
  onBeforeClose,
} = defineProps<Props>()

defineEmits(['close'])

const roleLabelMap = getRoleLabelMap()
const [showToast] = useResponseToast()
const { handleBusinessCode } = useHandleBusinessCode()

const currentMembers = defineModel<any[]>('currentMembers', { default: [] })

const needRefresh = ref(false)
const filteredMembers = ref<any[]>([])
const roleValue = ref(inviteRole)
const selectedProjects = ref(projectValues)
const memberValue = ref()

const isNewMember = computed(() => typeof memberValue.value === 'string')
const otherMembers = computed(() => multiple
  ? currentMembers.value
  : allMembers.filter(member => !!member.status && !currentMembers.value.some(m => m.userId === member.userId)),
)

const fuse = computed(() => new Fuse(otherMembers.value, {
  threshold: 0.3,
  keys: ['email', 'phone'],
}))

watch(() => memberValue.value, (value) => {
  if (typeof value === 'string') {
    const member = otherMembers.value.find(item => item.email === value.trim() && !!item.userId)
    if (member) {
      roleValue.value = member.role
      memberValue.value = member
    }
  }
})

onBeforeUnmount(() => {
  onBeforeClose?.(needRefresh.value)
})

function onSearch(event: AutoCompleteCompleteEvent) {
  if (!event.query.trim().length) {
    filteredMembers.value = [...otherMembers.value]
  }
  else {
    filteredMembers.value = fuse.value.search(event.query).filter(member => !!member.item.userId).map(member => member.item)
  }
}

function onOptionSelect({ value }: AutoCompleteOptionSelectEvent) {
  roleValue.value = value.role
}

async function joinProject() {
  const { userId, role, project_info } = memberValue.value
  const memberProjectIds = project_info.map((item: any) => item.project_id).concat(project?.projectId).filter(Boolean)
  const projectIds = [...new Set([...memberProjectIds, ...(selectedProjects.value ?? [])])]

  const { code, msg } = await API.team.userMdfTeamInfoV2Create({ userId, role, projectIds })
  showToast(code, msg)
  if (code !== 0)
    return
  updateCurrentMembers(toRaw(memberValue.value))
}

async function inviteNewMember() {
  if (multiple && !selectedProjects.value?.length) {
    showToast(-1, $t('请选择至少一个项目'))
    return
  }

  if (!isNewMember.value) {
    await joinProject()
    return
  }

  const projectIds = (selectedProjects.value ?? []).concat(project?.projectId).filter(Boolean)
  const { code, msg } = await API.limit.userInviteCreate({
    email: memberValue.value.trim(),
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
  updateCurrentMembers({
    userName: '--',
    email: memberValue.value,
    role: roleValue.value,
    avatarColor: '#FF9191',
  })
}

function updateCurrentMembers(member: Record<string, any>) {
  currentMembers.value.unshift(member)
  memberValue.value = undefined
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
      <div class="title">
        {{ $t('成员邮箱/手机号') }}
      </div>
      <div class="w-full flex items-center gap-2">
        <div class="flex-1 relative">
          <RoleSplit v-model="roleValue" :disabled="!isNewMember" class="!absolute right-2 position-y-center z-1" />
          <RxAutoComplete v-model="memberValue" class="w-full" size="lg" option-label="email" :placeholder="$t('成员邮箱/手机号')" :suggestions="filteredMembers"
                          :pt="{ overlay: filteredMembers.length > 0 ? 'block' : 'hidden' }" @complete="onSearch" @option-select="onOptionSelect"
          >
            <template #option="{ option }">
              <MemberInfo :avatar="option.avatar" :user-name="option.userName" :avatar-color="option.avatarColor" :email="option.email" :phone="option.phone" />
            </template>
            <template #empty>
              <span />
            </template>
          </RxAutoComplete>
        </div>
        <RxButton size="lg" :label="$t('邀请')" :disabled="!memberValue" @click="inviteNewMember" />
      </div>
    </div>
    <div v-if="!multiple && currentMembers?.length" class="flex flex-col gap-2">
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
</style>
