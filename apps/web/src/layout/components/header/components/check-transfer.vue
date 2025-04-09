<script setup lang="ts">
import ProfileInfo from '/@/views/browser/list/profiles/components/profile-info.vue'
import SecurityTips from '/@/layout/components/header/components/security-tips.vue';
import { API } from '/@/api';
import { $t } from '/@/locales';
import { useWorkspaceStore } from '/@/stores/workspace'
import { useResponseToast } from "/@/hooks/useResponseToast";
import { useHandleBusinessCode } from "/@/hooks/useResponseToast/handleBusinessCode";
import { useDialog as RxUseDialog } from '/@/hooks/useDialog'

const { windowTransferNo } = defineProps<{
  windowTransferNo: string
}>()

const emit = defineEmits(['close'])

const { handleBusinessCode } = useHandleBusinessCode()
const [showToast, onlyErrorToast] = useResponseToast()
const [dialogInstance] = RxUseDialog()
const workspaceStore = useWorkspaceStore()
const workspaceName = computed(() => workspaceStore.currentWorkspace?.workspaceName!.slice(0, 3).toLocaleUpperCase()!)

const transferTotal = ref(0)
const columns = [
  {
    title: $t('窗口信息'),
    key: 'profile',
    slot: 'profile',
    style: {
      width: '40%',
    },
  },
  {
    title: $t('备注'),
    key: 'note',
    slot: 'note',
    style: {
      width: '20%',
    },
  },
  {
    title: $t('转移至'),
    key: 'transfer',
    slot: 'transfer',
    style: {
      width: '20%',
    },
  },
  {
    title: $t('来自'),
    key: 'from',
    slot: 'from',
    style: {
      width: '20%',
    },
  },
]

async function tableRequest(params: any) {
  const result = await API.window.userGetTransferReceiveWindowListList({
    ...params,
    windowTransferNo
  })
  transferTotal.value = result.data.total
  return result
}

async function onReceive() {
  const { code, msg } = await API.window.userAgreeTransferWindowCreate({
    total: transferTotal.value,
    windowTransferNo
  })
  handleBusinessCode(code, () => {
    if (!localStorage.getItem('NOT_REMIND_TRANSFER_SECURITY')) {
      checkSecurityTips()
    }
    showToast(code, msg)
  })
  emit('close')
}

async function onReject() {
  const { code, msg } = await API.window.userRejectTransferWindowCreate({ windowTransferNo })
  onlyErrorToast(code, msg)
  if (code !== 0) return
  emit('close')
}

function checkSecurityTips() {
  dialogInstance.showModal({
    showHeader: false,
    modal: true,
    blockScroll: true,
    innerDialog: true,
    pt: {
      content: '!pa-0'
    },
    slots: {
      container: () => h(SecurityTips, {
        onClose: () => dialogInstance.hideModal()
      })
    }
  })
}
</script>

<template>
  <div class="flex flex-col pa-6 pt-4 gap-5 popup">
    <div class="flex justify-between items-center">
      <span class="header">Transfer profiles</span>
      <SvgIcon class="cursor-pointer" name="base/rx_ic_delete" size="20" color="#575D60" @click="$emit('close')" />
    </div>
    <div class="h-120">
      <RyTable :columns="columns" :table-request="tableRequest" :show-actions="false" :show-table-header="false">
        <template #profile="{ data }">
          <ProfileInfo :workspace-name="workspaceName" :data="data" disabled />
        </template>
        <template #note="{ data }">
          <RemarkIcon :value="data.windowRemark" disabled />
        </template>
        <template #transfer="{ data }">
          <div class="flex items-center">
            <RxAvatar :name="data.workspacePicture" :size="36" color="orange" :font-size="16" />
            <div class="">{{ data.workspaceName }}</div>
            <div class="">ID: {{ data.workspaceNo }}</div>
          </div>
        </template>
      </RyTable>
    </div>
    <div class="flex justify-end gap-2">
      <RxButton severity="secondary" size="sm" outlined :label="$t('拒绝')" @click="onReject" />
      <RxButton severity="primary" size="sm" :label="$t('接收')" @click="onReceive" />
    </div>
  </div>
</template>


<style lang="scss" scoped>
.popup {
  width: 960px;
}

.header {
  color: var(--Colors-text-text-primary, #111213);
  font-family: Inter;
  font-size: 16px;
  font-weight: 600;
  line-height: normal;
}
</style>