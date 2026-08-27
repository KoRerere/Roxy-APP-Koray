<script setup lang="tsx">
import RxAvatar from '/@/components/rx-avatar'
import { RxSvgIcon } from '/@/components/rx-icon/'
import { useMateGroup } from '/@/views/browser/create/hooks/useMate'
import { useTagsActions } from '/@/views/browser/list/tags/hook'
import { usePopupMenu } from '/@/hooks/usePopupMenu'
import { ProfileReqType } from '/@/enums'
import type { Operation } from '/@/utils'

interface Props {
  labels: any[]
  /** 列表接口常把 ID 序列化成字符串，与 OpenAPI number 不一致，需同时兼容 */
  projectId?: number | string
  disabled?: boolean
  genTag?: boolean
}

const { labels, projectId, disabled = false, genTag = true } = defineProps<Props>()

const emit = defineEmits(['update'])

const [addTag] = useTagsActions()
const { getTags, getProjectMember } = useMateGroup()
const { showMenu: showPopupMenu } = usePopupMenu()

const loading = ref(false)

const _members = computed(() =>
  (labels || [])
    .filter((item: any) => `${item.labelId}`.startsWith('u_'))
    .map(item => ({ ...item, color: item.labelColor, name: item.labelName, tooltip: item.labelName })),
)
const _tags = computed(() => (labels || []).filter((item: any) => !`${item.labelId}`.startsWith('u_')))

async function openMenu(event: MouseEvent) {
  if (disabled || loading.value)
    return

  loading.value = true
  const [tagList, memberList] = await Promise.all([getTags(), projectId ? getProjectMember(Number(projectId)) : [] as Operation[]])
  const value = labels?.map((item: any) => `${item.labelId}`)
  const options: Operation[] = memberList.concat(tagList)
  loading.value = false

  showPopupMenu(event, {
    mode: {
      type: 'multiple',
      value,
      options,
      field: 'value',
    },
    menuProps: {
      onHide: ({ value: labelIds }: any) => {
        const labelInfo = options.reduce((acc, item) => {
          if (labelIds.includes(item.value)) {
            const { avatar, avatarColor, userId, userName, color, id, name } = item._origin
            const data = userId
              ? { avatar, labelColor: avatarColor, labelId: `u_${userId}`, labelName: userName }
              : { labelColor: color, labelId: id, labelName: name }
            acc.push(data)
          }
          return acc
        }, [])

        if (!isEq(value, toRaw(labelIds))) {
          // u_ 开头的表示人员 id
          emit('update', {
            labelInfo,
            labelIds: (labelIds as string[] || []).map(value => value.startsWith('u_') ? value : Number(value)),
            requestType: ProfileReqType.SelectLabel,
          })
        }
      },
    },
    slots: {
      end: genTag
        ? () => {
            return (
              <div class="flex items-center gap-1.5 py-3 px-3.5 cursor-pointer border-0 border-t-1 border-solid border-[var(--component-dropdown-divider)]" onClick={onAddTag}>
                <RxSvgIcon name="base/rx_ic_plus"></RxSvgIcon>
                <div class="text-3.25">{$t('新增标签')}</div>
              </div>
            )
          }
        : undefined,
    },
  })
}

function isEq(oldIds: any, newIds: any) {
  return oldIds.slice().sort().join(',') === newIds.slice().sort().join(',')
}

function onAddTag() {
  const oldIds = labels.map((item: any) => item.labelId)
  addTag({
    confirmNext: ({ params, res }: any) => {
      emit('update', {
        labelInfo: [...labels, { labelColor: params.color, labelName: params.name, labelId: res.data.id }],
        labelIds: [...oldIds, res.data.id],
        requestType: ProfileReqType.SelectLabel,
      })
    },
  })
}

defineExpose({ openMenu })
</script>

<template>
  <div class="flex items-center gap-2">
    <RxTag v-if="!labels?.length" class="cursor-pointer !rounded-full" icon="base/rx_ic_tag" @click.stop="openMenu" />
    <template v-else>
      <RxAvatar v-if="_members.length" class="cursor-pointer" :list="_members" :size="24" :font-size="12" :max="3" @click.stop="openMenu" />
      <div v-for="label in _tags" :key="label.labelId" class="flex items-center select-none" :title="label.labelName" :class="[disabled ? 'cursor-not-allowed' : 'cursor-pointer']"
           @click.stop="openMenu"
      >
        <div class="label pointer-events-none">
          <svg class="shrink-0" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M5 8C5 6.34315 6.34315 5 8 5C9.65685 5 11 6.34315 11 8C11 9.65685 9.65685 11 8 11C6.34315 11 5 9.65685 5 8Z" :fill="label.labelColor" />
          </svg>
          <div class="ellipsis-1">
            {{ label.labelName }}
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<style lang="scss" scoped>
.label {
  display: flex;
  justify-content: start;
  align-items: center;
  padding: var(--spacing-sm, 4px) 8px var(--spacing-sm, 4px) var(--spacing-sm, 4px);
  max-width: 100px;
  min-width: 24px;
  border-radius: 40px;
  border: 0.5px solid var(--component-tag-border, #e4e8eb);
  background: var(--component-tag-bg, #f0f3f5);

  color: var(--component-tag-text, #575d61);
  font-family: Inter;
  font-size: 12px;
  font-style: normal;
  font-weight: 500;
  line-height: var(--Line-Height-text-xs, 16px);
}
</style>
