<script setup lang="ts">
import InviteIntoWorkspace from './invite-into-workspace.vue'
import RxToastHeadless from './rx-toast-headless.vue'
import { RxSvgIcon } from '/@/components/rx-icon/'

onMounted(() => {
  electronAPI.send('web:ready')
  console.log('web:ready')
})
</script>

<template>
  <Toast group="tr" />
  <RxToastHeadless />
  <ConfirmDialog :pt="{ root: global.dialog }" />
  <!-- 删除确认弹窗 -->
  <ConfirmDialog group="deleteConfirmDialog" :pt="{ root: global.dialog }">
    <template #container="{ message, acceptCallback, rejectCallback }">
      <div :class="message.class">
        <span class="p-dialog-header">
          <span class="p-dialog-title">{{ message.header }}</span>
        </span>
        <div class="p-dialog-content">
          <span class="p-confirmdialog-message"> {{ message.message }}</span>
        </div>
        <div class="p-dialog-footer">
          <div class="flex flex-1 items-center" v-if="message.checkProps">
            <Checkbox v-model="message.checkProps.value" :pt="{ root: 'items-center', box: '!w-4 !h-4' }" input-id="double" binary />
            <label for="double" class="text-3 select-none ma-1.5 cursor-pointer">{{ message.checkProps.label }}</label>
            <RxSvgIcon v-if="message.checkProps.tooltip" v-tooltip="{ value: message.checkProps.tooltip, showDelay: 500, hideDelay: 300 }" name="base/rx_ic_info" :size="12" />
          </div>

          <RxButton outlined :label="$t('取消')" v-bind="message.rejectProps" @click="rejectCallback" />
          <RxButton severity="danger" v-bind="message.acceptProps" @click="acceptCallback" />
        </div>
      </div>
    </template>
  </ConfirmDialog>
  <DynamicDialog />
  <!-- 通过邮箱邀请链接拉起弹窗 -->
  <InviteIntoWorkspace />
</template>

<style module="global">
.dialog {
  min-width: 350px;
  max-width: 400px;
}
</style>