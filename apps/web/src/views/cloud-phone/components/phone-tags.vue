<script setup lang="tsx">
import { computed, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { useDialog } from 'primevue/usedialog'
import RxButton from '/@/components/rx-button'
import RxTag from '/@/components/rx-tag.vue'
import { usePopupMenu } from '/@/hooks/usePopupMenu'
import { useResponseToast } from '/@/hooks/useResponseToast'
import TagEdit from '/@/views/browser/list/tags/edit.vue'
import { defaultColors } from '/@/utils/constants'
import { useCloudPhones } from '../useCloudPhones'

const selected = defineModel<string[]>({ default: () => [] })
const { t: $t } = useI18n()
const { phoneTags, addTag } = useCloudPhones()
const dialog = useDialog()
const { showMenu, hideMenu } = usePopupMenu()
const [showToast] = useResponseToast()

const tags = computed(() => [
  ...phoneTags.value,
  ...selected.value.filter(name => !phoneTags.value.some(tag => tag.name === name))
    .map(name => ({ name, color: defaultColors[4]! })),
])

function colorFor(name: string) {
  return tags.value.find(tag => tag.name === name)?.color
}

function openMenu(event: MouseEvent) {
  const previous = [...selected.value]
  void showMenu(event, {
    mode: {
      type: 'multiple',
      value: previous,
      field: 'value',
      options: tags.value.map(tag => ({
        label: tag.name,
        value: tag.name,
        render: () => (
          <div class="flex min-w-0 flex-1 items-center overflow-hidden">
            <svg class="shrink-0" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <circle cx="8" cy="8" r="3" fill={tag.color} />
            </svg>
            <span class="ellipsis-1 text-3.25" title={tag.name}>{tag.name}</span>
          </div>
        ),
      })),
    },
    menuProps: {
      onHide: ({ value }: { value: string[] }) => {
        if (previous.slice().sort().join('\0') !== value.slice().sort().join('\0')) {
          selected.value = [...value]
        }
      },
    },
    slots: {
      end: () => (
        <div class="border-0 border-t-1 border-solid border-[var(--component-dropdown-divider)]">
          <RxButton class="!w-full !justify-start !rounded-0 !px-3.5 !py-3 !text-3.25" text severity="secondary" icon="base/rx_ic_plus" label={$t('新增标签')} onClick={onAddTag} />
        </div>
      ),
    },
  })
}

async function onAddTag() {
  hideMenu()
  await nextTick()
  dialog.open(TagEdit, {
    props: { showHeader: false, modal: true, blockScroll: true },
    data: {
      props: { requireColorSelection: true },
      onConfirm: ({ name, color }: { name: string, color: string }) => {
        if (phoneTags.value.some(tag => tag.name.toLowerCase() === name.trim().toLowerCase())) {
          showToast(-1, $t('标签名已存在'))
          return false
        }
        try {
          const tag = addTag(name, color)
          selected.value = [...new Set([...selected.value, tag.name])]
        }
        catch {
          showToast(-1, $t('保存失败，请检查本地存储空间后重试'))
          return false
        }
      },
    },
  })
}

defineExpose({ openMenu })
</script>

<template>
  <div class="flex min-w-0 items-center gap-2 overflow-hidden">
    <slot name="trigger" :open-menu="openMenu">
      <button v-if="!selected.length" type="button" class="cursor-pointer rounded-full border-0 bg-transparent p-0" :aria-label="$t('添加标签')" @click.stop="openMenu">
        <RxTag class="pointer-events-none !rounded-full" icon="base/rx_ic_tag" />
      </button>
      <button v-for="name in selected" :key="name" type="button" class="flex max-w-25 shrink-0 cursor-pointer items-center rounded-full border-0.5 border-solid border-[var(--component-tag-border)] bg-[var(--component-tag-bg)] py-1 pl-1 pr-2 text-left font-[Inter] text-3 font-500 leading-4 text-[var(--component-tag-text)]" :title="name" @click.stop="openMenu">
        <svg class="pointer-events-none shrink-0" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="8" cy="8" r="3" :fill="colorFor(name)" />
        </svg>
        <span class="pointer-events-none truncate">{{ name }}</span>
      </button>
    </slot>
  </div>
</template>
