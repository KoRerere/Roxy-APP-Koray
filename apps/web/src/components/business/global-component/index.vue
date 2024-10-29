<script setup lang="ts">
import InviteIntoWorkspace from './invite-into-workspace.vue'

onMounted(() => {
  electronAPI.send('web:ready')
  console.log('web:ready')
})
</script>

<template>
  <Toast position="top-center" />
  <Toast group="tr" />
  <ConfirmDialog :pt="{ root: 'rx-dialog' }" />
  <!-- 删除确认弹窗 -->
  <ConfirmDialog group="deleteConfirmDialog">
    <template #container="{ message, acceptCallback, rejectCallback }">
      <div :class="message.class">
        <span class="p-dialog-header">
          <span class="p-dialog-title">{{ message.header }}</span>
        </span>
        <div class="p-dialog-content">
          <span class="p-confirmdialog-message"> {{ message.message }}</span>
        </div>
        <div class="p-dialog-footer">
          <RxButton outlined :label="$t('Cancel')" v-bind="message.rejectProps" @click="rejectCallback" />
          <RxButton severity="danger" v-bind="message.acceptProps" @click="acceptCallback" />
        </div>
      </div>
    </template>
  </ConfirmDialog>
  <DynamicDialog />
  <!-- 通过邮箱邀请链接拉起弹窗 -->
  <InviteIntoWorkspace />
</template>
