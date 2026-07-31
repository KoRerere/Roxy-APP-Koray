<script setup lang="ts">
import { h } from 'vue'
import AccountList from './account-list.vue'
import Tags from '/@/views/browser/list/tags'
import { useDialog } from '/@/hooks/useDialog'
import { usePermission } from '/@/hooks/usePermission'

const [showDialog] = useDialog()
const { check } = usePermission()

function openManageCategory() {
  showDialog({
    showHeader: false,
    modal: true,
    blockScroll: true,
    pt: {
      content: '!pa-0',
    },
    slots: {
      container: ({ hideModal }) => h(Tags, {
        onClose: hideModal,
      }),
    },
  })
}
</script>

<template>
  <div class="flex flex-col w-full h-full">
    <ViewsHeader>
      <RxButton v-if="check('Profiles_Label_view_page')" v-tooltip.top="{ value: $t('标签管理') }" severity="secondary" variant="text" size="xxs" icon="base/rx_ic_tag" @click="openManageCategory" />
    </ViewsHeader>
    <div class="flex-1 overflow-hidden">
      <AccountList />
    </div>
  </div>
</template>
