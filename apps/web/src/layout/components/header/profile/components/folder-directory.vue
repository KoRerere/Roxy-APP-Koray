<script setup lang="ts">
import FolderHelp from '/@/layout/components/header/profile/components/folder-help.vue';
import { useProfileEntityLabels } from '/@/composables/useProfileEntityLabels'
import { useDialog } from '/@/hooks/useDialog'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { supportsApp4_0_0 } from '/@/utils/app-supports'

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
const profileLabels = useProfileEntityLabels()

async function hasOpenProfiles() {
  const result = await globalThis.electronAPI.send('browser:getOpenedBrowser')
  return result?.length > 0
}

async function showEditDirModal(item: Items) {
  if (await hasOpenProfiles()) {
    onlyErrorToast(-1, profileLabels.value.closeBrowserBeforeDirectoryChange)
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
  const dirPath = await globalThis.electronAPI.send('dialog:selectDir', item.value)
  if (!dirPath)
    return

  if (supportsApp4_0_0()) {
    const result = await globalThis.electronAPI.send('app:ensureBrowserCacheRootDir', dirPath)
    if (!result.ok) {
      onlyErrorToast(-1, $t('无法创建缓存目录，请检查路径是否存在且可写'))
      return
    }
    item.value = result.path
  }
  else {
    item.value = dirPath
  }

  await onChange(item)
  showCacheDir()
}

function showCacheDir() {
  globalThis.electronAPI.send("app:showCacheDir")
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
