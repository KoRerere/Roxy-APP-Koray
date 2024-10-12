<script setup lang="tsx">
import { API } from '/@/api'
import { RxSvgIcon } from '/@/components/rx-icon/'
import { useRoleStore } from '/@/stores/role'
import { useTagsActions } from '/@/views/browser/list/tags/hook'
import { usePopoverMenu } from './popover-menu'

const props = defineProps({
  labels: {
    type: Array as PropType<any[]>,
    default: () => ([]),
  },
})

const emit = defineEmits(['update'])

const [addTag] = useTagsActions({ toast: false })
const [showMenu] = usePopoverMenu()
const role = useRoleStore()

// const styles = useCssModule()

async function openMenu(event: any) {
  const { data } = await API.window.userGetLabelInfoList({ page_index: '1', page_size: '999' })
  const operation = data.rows.map((item: any) => ({ name: item.name, label: item.name, value: `${item.id}` }))
  const value = props.labels.map((item: any) => `${item.labelId}`)

  showMenu(event, {
    type: 'checkbox',
    value,
    operation,
    onHide: (labelIds: string[]) => {
      if (!isEq(value, toRaw(labelIds))) {
        emit('update', { labelIds: (labelIds || []).map(Number) })
      }
    },
    afterCmp: () => {
      return (
        <div class="flex items-center gap-1.5 py-3 px-3.5 cursor-pointer border-0 border-t-1 border-solid border-gray-200" onClick={onAddTag}>
          <RxSvgIcon name="base/rx_ic_plus"></RxSvgIcon>
          <div>Add Tag</div>
        </div>
      )
    },
  })
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
    <RyButton v-if="!labels?.length" v-tooltip.top="{ value: 'Add tags', showDelay: 500 }" :disabled="role.isViewer"
      severity="secondary" size="small" text icon="base/rx_ic_tag" @click.stop="openMenu" />
    <template v-else>
      <div v-for="label in labels" :key="label.labelId" class="select-none cursor-pointer label">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path
            d="M5 8C5 6.34315 6.34315 5 8 5C9.65685 5 11 6.34315 11 8C11 9.65685 9.65685 11 8 11C6.34315 11 5 9.65685 5 8Z"
            :fill="label.labelColor" />
        </svg>
        <div @click.stop="openMenu">
          {{ label.labelName }}
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.label {
  display: flex;
  min-width: 24px;
  padding: var(--spacing-sm, 4px) 8px var(--spacing-sm, 4px) var(--spacing-sm, 4px);
  justify-content: center;
  align-items: center;
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
