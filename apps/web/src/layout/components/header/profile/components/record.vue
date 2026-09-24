<script setup lang="ts">
import ActivityRule from '/@/views/campaign/spring-festival/activity-rule.vue'
import RedeemCodeModal from '/@/views/pay/wallet/components/redeem-code-modal.vue'
import { API } from '/@/api'
import { useCampaignStore } from '/@/stores/campaign'
import { useDialog } from '/@/hooks/useDialog'
import { useResponseToast } from '/@/hooks/useResponseToast'
import { usePay } from '/@/views/pay/wallet/hook.tsx'
import { copyText } from '/@/utils'

const emit = defineEmits(['close'])

const [showModal] = useDialog()
const [showToast] = useResponseToast()
const { planSuccess } = usePay()
const { seasonalActivity } = storeToRefs(useCampaignStore())

const statusStrMap = {
  0: $t('有效'),
  1: $t('已使用'),
  2: $t('过期'),
}

const columns = [
  {
    title: $t('奖励类型'),
    key: 'rewardType',
    slot: 'type',
  },
  {
    title: $t('兑换码'),
    key: 'code',
    headerSlot: 'codeHeader',
  },
  {
    title: $t('兑换码有效期'),
    key: 'expireDate',
  },
  {
    title: $t('状态'),
    slot: 'status',
  },
  {
    title: $t('操作'),
    slot: 'actions',
  },
]

async function getCdkeyList() {
  const { code, data, msg } = await API.pay.userRedeemCodeListList()
  return { code, data: { rows: data }, msg }
}

function onCopy(code: string) {
  copyText(code)
  showToast(0, $t('复制成功'))
}

/** 打开兑换弹窗并预填当前兑换码，成功后关闭列表避免仍显示「有效」 */
function onRedeem(redeemCode: string) {
  showModal({
    showHeader: false,
    modal: true,
    blockScroll: true,
    slots: {
      container: ({ hideModal }) => h(RedeemCodeModal, {
        defaultCode: redeemCode,
        onClose: hideModal,
        onConfirm: async (code: string) => {
          const { code: resultCode, msg } = await API.pay.userRedeemWindowCodeCreate({ code })
          showToast(resultCode, msg)
          if (resultCode !== 0) {
            return
          }
          planSuccess(true)
          hideModal()
          emit('close')
        },
      }),
    },
  })
}

function giftRule() {
  showModal({
    showHeader: false,
    modal: true,
    blockScroll: true,
    slots: {
      container: ({ hideModal }) => h(ActivityRule, {
        onClose: hideModal,
      }),
    },
  })
}
</script>

<template>
  <div class="w-200 inline-flex flex-col pa-6 pt-4 gap-4">
    <div class="h-9 flex justify-between items-center">
      <span class="header">{{ $t('🎁 兑换码') }}</span>
      <SvgIcon class="cursor-pointer" name="base/rx_ic_delete" size="20" color="var(--colors-icon-icon-secondary)" @click="$emit('close')" />
    </div>
    <div class="h-70 overflow-hidden">
      <RyTable :columns="columns" :table-request="getCdkeyList" :show-table-header="false" :show-actions="false" :paginator="false" :multiple-operation="false"
               :row-class="(data: any) => ({ 'p-disabled': data.status !== 0 })"
      >
        <template #table-empty>
          <CustomEmpty :title="$t('暂无兑换码')" />
        </template>

        <template #type="{ data }">
          <div class="flex items-center">
            <div>{{ data.rewardType }}</div>
            <SvgIcon v-if="data.codeDesc" v-tooltip="data.codeDesc" class="cursor-pointer" size="13" name="base/rx_ic_info" color="var(--colors-icon-icon-note)" />
          </div>
        </template>

        <template #codeHeader="slotProps">
          <div class="flex items-center gap-1.5" :class="(slotProps as any).class">
            <span>{{ slotProps.column.title }}</span>
            <SvgIcon v-if="seasonalActivity.springFestival" class="cursor-pointer color-[#989CA0]" name="base/rx_ic_info" size="14" @click.stop="giftRule" />
          </div>
        </template>

        <template #status="{ data }">
          <div class="flex justify-start">
            <div class="rounded-full px-2 py-0.5" :class="[data.status === 0 ? 'available' : 'expire']">
              {{ statusStrMap[data.status as keyof typeof statusStrMap] }}
            </div>
          </div>
        </template>
        <template #actions="{ data }">
          <div class="flex items-center gap-2">
            <RxButton v-if="data.status === 0" size="xxs" variant="text" icon="base/rx_ic_copy" :label="$t('复制')" @click="onCopy(data.code)" />
            <RxButton v-if="data.status === 0" size="xxs" variant="text" icon="base/rx_ic_medal" :label="$t('兑换')" @click="onRedeem(data.code)" />
          </div>
        </template>
      </RyTable>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.header {
  color: var(--colors-text-text-primary);
  font-size: 16px;
  font-weight: 600;
  line-height: normal;
}

.available {
  color: var(--component-dropdown-text-active);
  font-family: 'DingTalk JinBuTi';
  font-size: 12px;
  background: linear-gradient(
    103deg,
    var(--campaign-may-freedom-bg-gradient-1, #4096ff) 0.45%,
    var(--campaign-may-freedom-bg-gradient-2, #01cab3) 60.72%
  );
}

.expire {
  color: var(--colors-text-text-inactive);
  font-family: 'DingTalk JinBuTi';
  font-size: 12px;
  background: var(--colors-background-bg-block);
}
</style>
