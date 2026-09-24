<script setup lang="tsx">
import { h } from 'vue'
import ActivityInfoExpand from '/@/views/campaign/new-user/activity-info-expand.vue'
import ActivityInfoMidAutumnFestival from '/@/views/campaign/mid-autumn-festival/activity-info-expand.vue'
import WalletPayModal from '/@/views/pay/wallet/components/wallet-pay-modal.vue'
import Detail from '/@/views/pay/subscribe/components/detail.vue'
import { useFreedomActivity } from '/@/views/campaign/freedom/hook.ts'
import { RxAlert } from '/@/components/rx-alert'
import currency from 'currency.js'
import { useCampaignStore } from '/@/stores/campaign'
import { discountCalculate } from '/@/views/pay/subscribe/util.ts'
import { useRoleStore } from '/@/stores/role'
import { useUserStore } from '/@/stores/user'
import { useSimpleLocale } from '/@/stores/locale'
import { useDialog } from '/@/hooks/useDialog'
import { useBillingEntityLabels } from '/@/composables/useBillingEntityLabels'

const dialogRef = inject<any>('dialogRef')
/** 扩容弹窗入参：默认选中类型、是否因额度不足打开 */
const _props = ref<{ defaultType?: 'workspace' | 'staff', insufficient?: boolean }>()
const _onConfirm = ref()
const _onCancel = ref()

const billingLabels = useBillingEntityLabels()

const { isOwner } = storeToRefs(useRoleStore())
const { userPayInfo } = storeToRefs(useUserStore())
const { seasonalActivity, currentActivity } = storeToRefs(useCampaignStore())
const { mixpanelTrack } = useUserStore()
const { getOfficialWebsite } = useSimpleLocale()
const { showFreedomActivityModal } = useFreedomActivity()
const [showModal] = useDialog()

const min = 0
const max = 500

const buyList = ref([
  {
    key: 'staff',
    label: $t('团队成员'),
    value: 0,
    cost: 5,
  },
  {
    key: 'workspace',
    label: $t('团队'),
    value: 0,
    cost: 10,
    visible: isOwner.value,
  },
].filter(item => item.visible !== false))

const renderList = computed<any[]>(() => {
  return [...buyList.value]
})

const allAmount = computed(() => buyList.value.reduce((acc, item) => currency(item.value).multiply(item.cost).add(acc).value, 0))

const disabled = computed(() => !buyList.value.some(item => item.value > 0))

const allDiscount = computed(() => {
  const { discount } = userPayInfo.value!

  const discounts = Object.fromEntries([
    ['discount', discount, true],
  ].filter(([_, __, assert]) => assert).map(([key, value, __]) => [key, value]))

  return {
    ...discounts,
    finalDiscount: discountCalculate(Object.values(discounts)),
  }
})

const finalAmount = computed(() => currency(allAmount.value).multiply(allDiscount.value.finalDiscount).value)
const discountAmount = computed(() => currency(allAmount.value).subtract(finalAmount.value).value)

const detail = computed(() => {
  // 身份折扣文案暂不对外展示，折扣仍参与计价
  // const { discount } = allDiscount.value

  const list = buyList.value.map(item => ({
    title: item.label,
    items: [
      {
        label: $t('数量'),
        value: item.value,
      },
      {
        label: $t('赠送'),
        value: item.value,
        visible: seasonalActivity.value.midAutumnFestival && currentActivity.value.team_bogo,
        slot: 'bonus',
      },
      {
        label: $t('单价'),
        value: currency(item.cost).format(),
      },
    ].filter(item => item.visible !== false),
  })).concat([
    // 身份折扣文案暂不对外展示，折扣仍参与计价
    // {
    //   items: [
    //     {
    //       label: $t('专属折扣'),
    //       class: '!color-[#FC9D12]',
    //       value: `-${discount}%`,
    //       visible: !!discount,
    //     },
    //   ].filter(item => item.visible !== false),
    // },
    {
      items: [
        {
          label: $t('套餐原价'),
          value: currency(allAmount.value).format(),
          visible: allAmount.value !== finalAmount.value,
          slot: 'oldprice',
        },
        {
          label: $t('实际价格'),
          value: currency(finalAmount.value).format(),
          slot: 'price',
        },
      ].filter(item => item.visible !== false),
    },
  ] as any[]).filter(item => item.items.length)

  return list
})

onMounted(() => {
  mixpanelTrack('click_enter_quota_expansion')
  const { props, onConfirm, onCancel } = dialogRef.value.data
  _props.value = props
  _onConfirm.value = onConfirm
  _onCancel.value = onCancel
  buyList.value.forEach((item) => {
    if (item.key === props.defaultType) {
      Reflect.set(item, 'value', 1)
    }
  })
})

function onUpdate(value: number, item: any) {
  nextTick(() => {
    if (!value) {
      item.value = 0
    }
  })
}

async function confirm() {
  mixpanelTrack('click_confirm_quota_expansion')
  showModal({
    showHeader: false,
    modal: true,
    blockScroll: true,
    slots: {
      container: ({ hideModal }) => h(WalletPayModal, {
        amount: finalAmount.value,
        originalAmount: allAmount.value,
        discountAmount: discountAmount.value,
        onClose: hideModal,
        onConfirm: async ({ payType }) => {
          mixpanelTrack('click_pay_quota_expansion')
          await _onConfirm.value?.({
            payType,
            purchaseMember: Object.fromEntries(buyList.value.map(item => [item.key, item.value])),
          })
          showFreedomActivityModal()
          close(false)
        },
      }),
    },
  })
}

function close(isCancel: boolean) {
  dialogRef.value.close()
  if (isCancel) {
    _onCancel.value?.()
  }
}

/** 额度不足与普通入口共用同一条 Alert，文案按类型在弹窗内组装，避免外部传入翻译串 */
const alertProps = computed(() => {
  const memberCount = userPayInfo.value?.maxMemberCount
  const workspaceCount = userPayInfo.value?.maxWorkspaceCount
  const current = $t('您当前拥有: {member} 团队成员, {workspace} 团队', { member: memberCount, workspace: workspaceCount })

  const member = {
    type: 'warn' as const,
    title: $t('团队成员不足，您当前拥有: {member} 团队成员, {workspace} 团队', { member: memberCount, workspace: workspaceCount }),
    content: $t('你已达到添加团队成员的最大上限。你可以移除非活跃的团队成员或购买更多'),
  }

  const workspace = {
    type: 'warn' as const,
    title: $t('团队不足，您当前拥有: {member} 团队成员, {workspace} 团队', { member: memberCount, workspace: workspaceCount }),
    content: $t('你已达到添加团队的最大上限。你可以移除非活跃的团队或购买更多'),
  }

  if (!_props.value?.insufficient) {
    return {
      type: 'info' as const,
      title: current,
    }
  }

  return _props.value.defaultType === 'workspace' ? workspace : member
})
</script>

<template>
  <div class="flex flex-col pl-8 pr-6 py-6 gap-6 popup">
    <div class="relative flex items-center h-10">
      <div class="flex items-center gap-1 header">
        <span>{{ $t('扩充您的团队') }}</span>
        <SvgIcon v-tooltip.top="billingLabels.teamIsolationDescription" class="cursor-pointer" name="base/rx_ic_info" size="20" color="var(--colors-icon-icon-tertiary)" />
      </div>
      <SvgIcon class="absolute right-0 cursor-pointer" size="24" name="base/rx_ic_delete" @click="close(true)" />
    </div>
    <div class="flex gap-6">
      <div class="flex-1 flex flex-col gap-6">
        <div class="flex flex-col gap-4">
          <RxAlert class="w-full" size="small" :closable="false" v-bind="alertProps" />
          <div class="flex flex-col gap-1.5">
            <div class="tt-primary text-4 font-700 leading-normal">
              {{ $t('请选择数量') }}
            </div>
            <div class="tt-tertiary text-3 leading-normal">
              {{ $t('团队成员和团队购买后永久有效') }}
            </div>
          </div>
          <div class="flex flex-col gap-6">
            <div v-for="item in renderList" :key="item.label" class="flex items-center gap-4">
              <component :is="item.render" v-if="item.render" class="w-full" />
              <template v-else>
                <div class="w-28 label">
                  {{ item.label }}
                </div>
                <RxStepInput v-model="item.value" class="!w-30" size="xs" :min="min" :max="max" @update:model-value="onUpdate($event, item)" />
                <div>{{ currency(item.cost).format() }} / {{ item.label }}</div>
              </template>
            </div>
          </div>
        </div>
        <ActivityInfoExpand />
        <ActivityInfoMidAutumnFestival />
      </div>
      <Detail class="w-88" :list="detail">
        <template #bonus="{ item, classes }">
          <div class="flex justify-between tt-success" :class="classes">
            <div>{{ item.label }}</div>
            <div>{{ item.value }}</div>
          </div>
        </template>
        <template #oldprice="{ item }">
          <div class="flex justify-between">
            <div class="details-label">
              {{ item.label }}
            </div>
            <div class="details-oldprice">
              {{ item.value }}
            </div>
          </div>
        </template>
        <template #price="{ item }">
          <div class="flex justify-between items-center">
            <div class="details-label">
              {{ item.label }}
            </div>
            <div>
              <div class="details-price">
                {{ item.value }}
              </div>
              <div v-if="discountAmount > 0" class="details-diffprice">
                {{ $t('立省 {value}', {
                  value: currency(discountAmount).format(),
                }) }}
              </div>
            </div>
          </div>
        </template>
        <template #after>
          <div class="flex-1 flex flex-col justify-end gap-3">
            <RxButton :disabled="disabled" size="lg" :label="$t('确认付款')" @click="confirm" />
            <i18n-t tag="div" class="select-none terms" :keypath="$t('继续操作即表示您同意我们的 {terms}', { terms: '{terms}' })" scope="global">
              <template #terms>
                <a class="terms-link" :href="getOfficialWebsite('/copyright/user')" target="_blank">{{ $t('用户协议') }}</a>
              </template>
            </i18n-t>
          </div>
        </template>
      </Detail>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.popup {
  width: clamp(960px, 72.5vw, 1024px);
}

.header {
  color: var(--colors-text-text-primary, #fafafa);
  font-size: 24px;
  font-weight: 600;
  line-height: 20px;
}

.label {
  color: var(--colors-text-text-primary, #fafafa);
  font-size: 14px;
  line-height: normal;
}

.total {
  color: var(--colors-text-text-secondary, #b2b6b8);
  font-family: Inter;
  font-size: 14px;
  line-height: 20px;

  &-price {
    color: #12a3fc;
    font-size: 20px;
    font-weight: 600;
  }
}

.details {
  &-label {
    color: var(--colors-text-text-primary, #fafafa);
    font-family: Inter;
    font-size: 14px;
    font-weight: 600;
    line-height: 20px;
  }

  &-oldprice {
    color: var(--colors-text-text-tertiary, #575d60);
    font-family: Inter;
    font-size: 16px;
    line-height: 20px;
    text-decoration-line: line-through;
  }

  &-price {
    color: #12a3fc;
    text-align: right;
    font-family: Inter;
    font-size: 24px;
    font-weight: 600;
    line-height: normal;
  }

  &-diffprice {
    color: var(--primitives-yellow-500, #fc9d12);
    text-align: right;
    font-family: Inter;
    font-size: 12px;
    font-weight: 500;
    line-height: normal;
  }
}

.terms {
  color: var(--colors-text-text-tertiary, #575d60);
  font-family: Inter;
  font-size: 12px;
  line-height: 18px;

  /* 150% */
  &-link {
    color: var(--colors-text-text-brand, #12a3fc);
    text-decoration-line: underline;
    text-decoration-style: solid;
    text-decoration-skip-ink: none;
    text-decoration-thickness: auto;
    text-underline-offset: auto;
    text-underline-position: from-font;
  }
}
</style>
