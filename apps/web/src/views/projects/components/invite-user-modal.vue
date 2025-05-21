<script setup lang="ts">
import Fuse from 'fuse.js'
import RoleSplit from './role-split.vue'
import TsFormMultiSelect from '/@/views/lab/components/form/m-input-multi-select.vue';
import { API } from '/@/api';
import { useResponseToast } from "/@/hooks/useResponseToast";
import { $t } from '/@/locales';
import { getRoleLabelMap, Role } from '/@/enums/'
import type { AutoCompleteCompleteEvent, AutoCompleteOptionSelectEvent } from 'primevue/autocomplete';

interface Props {
  project?: Record<string, any>
  projects?: any[]
  projectValues?: number[]
  allMembers?: any[]
  disabledSuggestions?: boolean
}

const { project, projects, projectValues, allMembers = [], disabledSuggestions = false } = defineProps<Props>()
const emit = defineEmits(['close'])

const roleLabelMap = getRoleLabelMap()
const [showToast] = useResponseToast()

const currentMembers = defineModel<any[]>('members', { default: [] })

const filteredMembers = ref()
const roleValue = ref(Role.VIEWER)
const selectedProjects = ref(projectValues)
const memberValue = ref()

const isNewMember = computed(() => typeof memberValue.value === 'string')
const otherMembers = computed(() => allMembers.filter(member => !!member.status && !currentMembers.value.some(m => m.userId === member.userId)))
const fuse = computed(() => new Fuse(otherMembers.value, {
  threshold: 0.3,
  keys: ['email', 'userName'],
}))


function onSearch(event: AutoCompleteCompleteEvent) {
  if (disabledSuggestions) {
    filteredMembers.value = []
    return
  }
  setTimeout(() => {
    if (!event.query.trim().length) {
      filteredMembers.value = [...otherMembers.value]
    } else {
      filteredMembers.value = fuse.value.search(event.query).map(member => member.item)
    }
  }, 250)
}

function onOptionSelect({ value }: AutoCompleteOptionSelectEvent) {
  roleValue.value = value.role
}

async function joinProject() {
  const { userId, role, project_info } = memberValue.value
  const projectIds = project_info.map((item: any) => item.project_id).concat(project!.projectId)

  const { code, msg } = await API.team.userMdfTeamInfoV2Create({ userId, role, projectIds })
  showToast(code, msg)
  if (code !== 0) return
  updateCurrentMembers(toRaw(memberValue.value))
}

async function inviteNewMember() {
  if (!isNewMember.value) {
    await joinProject()
    return
  }

  const projectIds = (selectedProjects.value ?? []).concat(project?.projectId).filter(Boolean)
  if (!projectIds.length) {
    showToast(-1, $t('请选择至少一个项目'))
    return
  }

  const { code, msg } = await API.limit.userInviteCreate({
    email: memberValue.value,
    role: roleValue.value,
    projectIds,
  })

  showToast(code, msg)
  if (code !== 0) return
  updateCurrentMembers({
    userName: '--',
    email: memberValue.value,
    role: roleValue.value,
    avatarColor: '#FF9191',
  })
}

function updateCurrentMembers(member: Record<string, any>) {
  currentMembers.value.push(member)
  memberValue.value = undefined
}
</script>

<template>
  <div class="flex flex-col pa-6 pt-4 gap-6 max-h-[80vh] overflow-y-auto popup">
    <div class="flex justify-between items-center">
      <span class="header">{{ $t('邀请用户加入{project}', { project: project?.projectName }) }}</span>
      <SvgIcon class="cursor-pointer" name="base/rx_ic_delete" size="20" color="var(--colors-icon-icon-secondary, #575D60)" @click="$emit('close')" />
    </div>
    <div class="flex flex-col gap-2" v-if="projects?.length">
      <div class="title">{{ $t('选择项目') }}</div>
      <TsFormMultiSelect v-model="selectedProjects" display="chip" size="md" optionValue="value" :options="projects" />
    </div>
    <div class="separator" v-if="projects?.length"></div>
    <div class="flex flex-col gap-2">
      <div class="title">{{ $t('成员邮箱') }}</div>
      <div class="w-full flex items-center gap-2">
        <div class="flex-1 relative">
          <RoleSplit v-model="roleValue" :disabled="!isNewMember" class="absolute right-2 top-1/2 -translate-y-1/2 z-1" />
          <RxAutoComplete class="w-full" v-model="memberValue" size="lg" optionLabel="email" placeholder="Email" :suggestions="filteredMembers" @complete="onSearch" @option-select="onOptionSelect">
            <template #option="{ option }">
              <div class="flex items-center gap-2">
                <RxAvatar :avatar="option.avatar" :name="option.userName.slice(0, 2)" :color="option.avatarColor" :size="28" :font-size="14" />
                <div>
                  <div class="member-name">{{ option.email }}</div>
                  <div class="member-email">{{ option.userName }}</div>
                </div>
              </div>
            </template>
            <template #empty>
              <div class="flex flex-row items-center gap-2">
                <div class="text-sm">{{ $t('未找到已有成员') }}</div>
              </div>
            </template>
          </RxAutoComplete>
        </div>
        <RxButton size="lg" :label="$t('邀请')" :disabled="!memberValue" @click="inviteNewMember" />
      </div>
    </div>
    <div class="flex flex-col gap-2" v-if="currentMembers?.length">
      <div class="title">{{ $t('当前项目成员列表') }}</div>
      <div class="member-list">
        <div class="flex items-center gap-2 member-item" v-for="member in currentMembers" :key="member.id">
          <RxAvatar :avatar="member.avatar" :name="member.userName.slice(0, 2)" :color="member.avatarColor" :size="28" :font-size="14" />
          <div class="w-60">
            <div class="member-item-name">{{ member.email }}</div>
            <div class="member-item-email">{{ member.userName }}</div>
          </div>
          <RxTag disabled :label="roleLabelMap[member.role as keyof typeof roleLabelMap]" />
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
:deep(.p-inputtext) {
  padding-right: 100px !important;
}

.popup {
  width: 480px;
}

.header {
  color: var(--Colors-text-text-primary, #111213);
  font-family: Inter;
  font-size: 16px;
  font-weight: 600;
  line-height: normal;
}

.title {
  color: var(--colors-text-text-primary, #111213);
  font-size: 14px;
  font-weight: 500;
  line-height: var(--Line-Height-text-xs, 16px);
}

.separator {
  background: var(--component-dropdown-divider, #C7D1D6);
  height: 1px;
  width: 100%;
}

.member {
  &-item {
    height: 52px;
    border-bottom: 0.5px solid var(--component-table-border, #C7D1D6);

    &:last-of-type {
      border-bottom: none;
    }

    &-email {
      color: var(--colors-text-text-primary, #111213);
      font-size: 12px;
      line-height: 16px;
    }

    &-name {
      color: var(--colors-text-text-tertiary, #575D60);
      font-size: 12px;
      line-height: 16px;
    }
  }
}
</style>