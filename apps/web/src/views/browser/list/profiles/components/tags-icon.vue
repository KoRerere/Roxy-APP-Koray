<script setup lang="tsx">
import { API } from '/@/api'
import RxAvatar from '/@/components/rx-avatar.vue'
import { RxSvgIcon } from '/@/components/rx-icon/'
import { $t } from '/@/locales'
import { useRoleStore } from '/@/stores/role'
import { useTagsActions } from '/@/views/browser/list/tags/hook'
import { usePopoverMenu } from './popover-menu'

interface Operation {
  name?: string
  label?: string
  value: string
  render?: () => any
}

interface Props {
  labels: any[]
  projectId: number
  disabled?: boolean
}

const { labels, projectId, disabled = false } = defineProps<Props>()

const emit = defineEmits(['update'])

const [addTag] = useTagsActions({ toast: false })
const [showMenu] = usePopoverMenu()
const role = useRoleStore()

// const styles = useCssModule()

const _disabled = computed(() => disabled || role.isViewer)
const _members = computed(() =>
  (labels || [])
    .filter((item: any) => `${item.labelId}`.startsWith('u_'))
    .map(item => ({ ...item, color: item.labelColor, name: item.labelName.slice(0, 2) })),
)
const _tags = computed(() => (labels || []).filter((item: any) => !`${item.labelId}`.startsWith('u_')))

async function openMenu(event: any) {
  if (_disabled.value)
    return

  const tagList = await getTags()
  const memberList = await getProjectMember()

  const value = labels?.map((item: any) => `${item.labelId}`)

  showMenu(event, {
    type: 'checkbox',
    value,
    operation: memberList.concat(tagList),
    onHide: (labelIds: string[]) => {
      if (!isEq(value, toRaw(labelIds))) {
        emit('update', { labelIds: (labelIds || []).map(value => value.startsWith('u_') ? value : Number(value)) })
      }
    },
    afterCmp: () => {
      return (
        <div class="flex items-center gap-1.5 py-3 px-3.5 cursor-pointer border-0 border-t-1 border-solid border-gray-200" onClick={onAddTag}>
          <RxSvgIcon name="base/rx_ic_plus"></RxSvgIcon>
          <div>{$t('Add Tag')}</div>
        </div>
      )
    },
  })
}

async function getTags(): Promise<Operation[]> {
  const { data } = await API.window.userGetLabelInfoList({ page_index: '1', page_size: '999' })
  return data.rows.map((item: any) => ({ name: item.name, label: item.name, value: `${item.id}` }))
}

async function getProjectMember(): Promise<Operation[]> {
  const { data } = await API.limit.userGetMemberInfoByProjectIdList({ projectId })
  return data.rows.map(item => ({
    value: `u_${item.userId}`,
    render: () => {
      return (<RxAvatar avatar={item.avatar} size={24} fontSize={12} name={item.userName?.slice(0, 2)} color={item.avatarColor} />)
    },
  }))
}

function isEq(oldIds: any, newIds: any) {
  return oldIds.slice().sort().join(',') === newIds.slice().sort().join(',')
}

function onAddTag() {
  addTag({
    confirmNext: ({ res }: any) => {
      emit('update', { labelIds: [res.data.id] })
    },
  })
}
</script>

<template>
  <div class="flex items-center gap-2">
    <RxButton v-if="!labels?.length" v-tooltip.top="{ value: 'Add tags', showDelay: 500 }" :disabled="_disabled" severity="secondary" size="xxs" text icon="base/rx_ic_tag" @click.stop="openMenu" />
    <template v-else>
      <RxAvatar v-if="_members.length" class="cursor-pointer" :list="_members" :size="24" :font-size="12" :max="3" @click.stop="openMenu" />
      <div v-for="label in _tags" :key="label.labelId" class="flex items-center select-none" :class="[_disabled ? 'cursor-not-allowed' : 'cursor-pointer']" @click.stop="openMenu">
        <div class="label">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M5 8C5 6.34315 6.34315 5 8 5C9.65685 5 11 6.34315 11 8C11 9.65685 9.65685 11 8 11C6.34315 11 5 9.65685 5 8Z" :fill="label.labelColor" />
          </svg>
          <div>
            {{ label.labelName }}
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
svg {
  pointer-events: none;
}

.label {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: var(--spacing-sm, 4px) 8px var(--spacing-sm, 4px) var(--spacing-sm, 4px);
  min-width: 24px;
  border-radius: 40px;
  border: 0.5px solid var(--Component-Colors-Tag-border, #e4e8eb);
  background: var(--Component-Colors-Tag-bg, #f0f3f5);

  color: var(--Component-Colors-Tag-text, #575d61);
  font-family: Inter;
  font-size: 12px;
  font-style: normal;
  font-weight: 500;
  line-height: var(--Line-Height-text-xs, 16px);
}
</style>
