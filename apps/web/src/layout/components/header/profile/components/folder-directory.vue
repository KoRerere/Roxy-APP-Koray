<script setup lang="ts">
import FolderHelp from '/@/layout/components/header/profile/components/folder-help.vue';
import { useDialog } from '/@/hooks/useDialog'
import { useResponseToast } from '/@/hooks/useResponseToast'

import type { Items } from '../type'

defineOptions({
  inheritAttrs: false,
})

interface Props {
  item: Items
  onChange: (params: any) => Promise<void>
}

const { onChange } = defineProps<Props>()

const [showModal] = useDialog()
const [_, onlyErrorToast] = useResponseToast()

async function hasOpenProfiles() {
  const result = await electronAPI.send('browser:getOpenedBrowser')
  return result?.length > 0
}

async function showEditDirModal(item: Items) {
  if (await hasOpenProfiles()) {
    onlyErrorToast(-1, $t('请先关闭浏览器窗口再执行此操作'))
    return
  }

  showModal({
    showHeader: false,
    modal: true,
    blockScroll: true,
    pt: {
      content: '!pa-0'
    },
    slots: {
      container: ({ hideModal }) => h(FolderHelp, {
        onClose: () => {
          hideModal()
        },
        onConfirm: () => {
          showCacheDir()
          selectDir(item)
          hideModal()
        },
      })
    }
  })
}

async function selectDir(item: Items) {
  const dirPath = await window.electronAPI.send('dialog:selectDir', item.value)
  if (dirPath) {
    item.value = dirPath
    await onChange(item)
    showCacheDir()
  }
}

function showCacheDir() {
  electronAPI.send("app:showCacheDir")
}
</script>

<template>
  <div class="flex gap-2">
    <InputText v-bind="$attrs" class="w-[186px]" type="text" />
    <RxButton v-tooltip.top="$t('查看')" outlined severity="secondary" icon="base/rx_ic_folder_open" @click="showCacheDir" />
    <RxButton v-tooltip.top="$t('编辑')" outlined severity="secondary" icon="base/rx_ic_edit" @click="showEditDirModal(item)" />
  </div>
</template>

<style scoped></style>
