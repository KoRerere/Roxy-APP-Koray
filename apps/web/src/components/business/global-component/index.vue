<script setup lang="tsx">
import { RxSvgIcon } from '/@/components/rx-icon/'
import { $t } from '/@/locales'
import { updatePrimeVueLocale } from '/@/locales/primevueLocale'
import RxToastHeadless from './rx-toast-headless.vue'
import { useSubscribe } from './useSubscribe'
import { isMainWindow } from '/@/utils'

const LiveChat = defineAsyncComponent(() => import('../live-chat/live-chat.vue'))
const InviteIntoWorkspace = defineAsyncComponent(() => import('./invite-into-workspace.vue'))
const PayWall = defineAsyncComponent(() => import('./pay-wall.vue'))
const Help = defineAsyncComponent(() => import('./help.vue'))

useSubscribe()

const isShowLiveChat = ref(false)

updatePrimeVueLocale()

setTimeout(() => {
  isShowLiveChat.value = true
}, 600)

</script>

<template>
  <Toast group="tr" />
  <ConfirmPopup group="popup"></ConfirmPopup>
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
          <div class="flex flex-1 items-center" v-if="message.checkboxProps">
            <Checkbox v-model="message.checkboxProps.value" :pt="{ root: 'items-center', box: '!w-4 !h-4' }"
              input-id="double" binary />
            <label for="double" class="text-3 select-none ma-1.5 cursor-pointer">
              {{ message.checkboxProps.label }}
            </label>
            <RxSvgIcon v-if="message.checkboxProps.tooltip"
              v-tooltip="{ value: message.checkboxProps.tooltip, showDelay: 500, hideDelay: 300 }"
              name="base/rx_ic_info" :size="12" />
          </div>

          <RxButton outlined :label="$t('取消')" v-bind="message.rejectProps" @click="rejectCallback" />
          <RxButton severity="danger" v-bind="message.acceptProps" @click="acceptCallback" />
        </div>
      </div>
    </template>
  </ConfirmDialog>
  <DynamicDialog />
  <!-- 只有在主窗口中显示的全局组件 -->
  <template v-if="isMainWindow">
    <!-- 通过邮箱邀请链接拉起弹窗 -->
    <InviteIntoWorkspace />
    <!-- 帮助 -->
    <Help v-if="$route.name !== 'login'" />
    <PayWall />
    <LiveChat v-if="isShowLiveChat" />
  </template>
</template>

<style module="global">
.dialog {
  min-width: 350px;
  max-width: 400px;
}
</style>
