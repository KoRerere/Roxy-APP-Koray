<template>
  <BaseDialog :header="$t('同步窗口列表')" @hide="handleHide">
    <WindowList v-if="mainControlWindowDirId" showType="syncing" :showTableHeader="false" :mainControlWindowDirId />
  </BaseDialog>
</template>

<script setup lang="ts">
import BaseDialog from './base-dialog.vue';
import WindowList from '../synchronizer/window-list.vue';
import { $t } from '/@/locales';

const mainControlWindowDirId = ref()


function handleHide() {
  electronAPI.send('syncControl:closeSyncingWindowListDialog');
}

electronAPI.send('syncControl:getMainControlDirId').then((dirId) => {
  mainControlWindowDirId.value = dirId
})
</script>

<style lang="scss">
.p-datatable-table-container {
  padding: 0;
}
</style>
