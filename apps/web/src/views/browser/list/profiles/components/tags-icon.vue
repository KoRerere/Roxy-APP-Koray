<script setup lang="ts">
import { API } from '/@/api'
import { useContextMenu } from '/@/components/rx-ctxmenu'
import { isEmptyValue } from '/@/utils'

defineProps({
  labels: {
    type: Array as PropType<any[]>,
    default: () => ([]),
  },
})

const emit = defineEmits(['update'])

const [show] = useContextMenu()

async function openMenu(event: any) {
  const { data } = await API.window.userGetLabelInfoList({ page_index: '1', page_size: '999' })
  const operation = data.rows.map((item: any) => ({ name: item.name, label: item.name, value: `${item.id}` }))

  show(event, {
    type: 'checkbox',
    operation,
    onHide: (labelIds: string[]) => {
      if (!isEmptyValue(labelIds)) {
        emit('update', { labelIds: labelIds.map(Number) })
      }
    },
  })
}
</script>

<template>
  <div class="flex items-center gap-2">
    <RyButton v-tooltip.top="{ value: 'Add tags', showDelay: 500 }" severity="secondary" size="small" text
      icon="base/rx_ic_tag" @click.stop="openMenu" />
    <div v-for="label in labels" :key="label.labelId" class="label">
      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
        <path
          d="M5 8C5 6.34315 6.34315 5 8 5C9.65685 5 11 6.34315 11 8C11 9.65685 9.65685 11 8 11C6.34315 11 5 9.65685 5 8Z"
          :fill="label.labelColor" />
      </svg>
      {{ label.labelName }}
    </div>
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
