<script setup lang="tsx">
import NumberFlow from '@number-flow/vue'
import type { UserGetPromotionInfoListData } from '@roxy/backend-api';
import { RxSvgIcon } from '/@/components/rx-icon';
import RxNumberFlow from '/@/components/rx-number-flow.vue'
import { useDialog } from '/@/hooks/useDialog'
import { $t } from '/@/locales';
import WithdrawDialog from './withdraw-dialog.vue'
import currency from 'currency.js'
import { useReferralProgram } from '../../useContext'

const { promotionInfo } = defineProps<{
  promotionInfo: UserGetPromotionInfoListData['data']
}>()


const maxNumber = 999999
const [dialogInstance] = useDialog()
const { getPromotionInfo } = useReferralProgram()
const overviewItems = computed(() => {
  const {
    promotionClickCount = 0, registeredUserNum = 0, purchaseUserNum = 0, totalIncome = 0, todayIncome = 0,
    todayRegisteredUserNum = 0, purchaseUserTotalAmount = 0, pendingAmount = 0,
    todayPromotionClickCount = 0, todayPurchaseUserNum = 0
  } = promotionInfo

  return [
    {
      title: $t('链接点击次数'),
      total: promotionClickCount,
      todayCount: todayPromotionClickCount,
      // tootip: $t('链接点击次数'),
    },
    {
      title: $t('名下用户'),
      total: registeredUserNum,
      todayCount: todayRegisteredUserNum,
      // tootip: $t('名下用户'),
    },
    {
      title: $t('充值用户'),
      total: purchaseUserNum,
      todayCount: todayPurchaseUserNum,
      // tootip: $t('充值用户'),
    },
    {
      title: $t('已获推广奖励'),
      total: Math.min(maxNumber, totalIncome),
      todayCount: todayIncome,
      // tootip: $t('已获推广奖励'),
      style: {
        color: '#12A3FC',
      },
      totalNumberFlowProps: {
        format: {
          style: 'currency',
          currency: 'USD',
          maximumFractionDigits: totalIncome > maxNumber ? 0 : 2,
        }
      },
    },
    {
      title: $t('近 30 天名下用户消费金额'),
      total: Math.min(purchaseUserTotalAmount, maxNumber),
      todayCount: 0,
      // tootip: $t('近 30 天名下用户消费金额'),
      totalNumberFlowProps: {
        format: {
          style: 'currency',
          currency: 'USD',
          maximumFractionDigits: purchaseUserTotalAmount > maxNumber ? 0 : 2,
        }
      }
    },
    {
      title: $t('审核中'),
      total: pendingAmount,
      todayCount: 0,
      tootip: $t('消费后 7 天内完成审核'),
      totalNumberFlowProps: {
        maximumFractionDigits: 0,
        format: { style: 'currency', currency: 'USD' }
      }
    },
  ]
})

function showWithdrawDialog() {
  dialogInstance.showModal({
    header: $t('申请提现'),
    class: 'w-[480px]',
    pt: {
      title: '!text-[20px]'
    },
    slots: {
      default: () => <WithdrawDialog hideFn={dialogInstance.handleCancel} onSuccess={getPromotionInfo} promotionInfo={promotionInfo} />,
      footer: undefined
    },
  })
}
</script>

<template>
  <div class="referal-reward">
    <img src="/images/payments/ripple.svg" class="ripple-bg">
    <div class="referal-reward-money">
      <div class="referal-reward-money-title">
        <span class="referal-reward-money-title-money">
          ${{ currency(promotionInfo.withdrawAmount) }}
        </span>
        <div class="desc">
          {{ $t('可提现余额') }}
        </div>
      </div>
      <div class="referal-reward-money-button">
        <RxButton severity="secondary" size="lg" outlined :label="$t('申请提现')" @click="showWithdrawDialog" />
      </div>
    </div>
    <div class="referal-reward-overview">
      <template v-for="item in overviewItems" :key="item.title">
        <div class="referal-reward-overview-item">
          <div class="title">
            <span class="total" :style="item.style">
              <NumberFlow locales="en-US" will-change :value="item.total" :last-value="0"
                v-bind="item.totalNumberFlowProps" />
            </span>
            <span v-if="item.todayCount" class="increase">
              <RxNumberFlow locales="en-US" prefix="+" will-change :value="item.todayCount" :last-value="0"
                v-bind="item.todayNumberFlowProps" />
            </span>
          </div>
          <div class="desc">
            {{ item.title }}
            <RxSvgIcon v-if="item.tootip" name="base/rx_ic_info" v-tooltip.top="item.tootip" size="12" />
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.referal-reward {
  display: flex;
  gap: 80px;
  position: relative;

  .ripple-bg {
    position: absolute;
    transform: scale(1.5);
    top: -207px;
    left: -180px;
  }

  .referal-reward-money {
    padding-top: 16px;
    display: flex;
    flex-direction: column;
    gap: 32px;
    flex: 1;
    z-index: 10;

    .referal-reward-money-title {
      display: flex;
      flex-direction: column;
      color: var(--Colors-Text-text-primary, #171C1F);
      font-family: Inter;
      font-size: 40px;
      font-style: normal;
      font-weight: 600;
      line-height: normal;


      .referal-reward-money-title-money::first-letter {
        font-size: 32px;
      }


      .desc {
        display: flex;
        align-items: center;
        gap: 4px;
        color: var(--Colors-Text-text-tertiary, #7C8387);
        font-family: Inter;
        font-size: 16px;
        font-style: normal;
        font-weight: 500;
        line-height: normal;
      }
    }


    .referal-reward-money-button {
      display: flex;
      gap: 8px;
      flex-direction: column;

      .referal-reward-money-button-text {
        padding-left: 16px;
        cursor: pointer;
        color: var(--Component-Colors-Buttons-Secondary-text, #171C1F);
        font-family: Inter;
        font-size: var(--Font-Size-text-lg, 14px);
        font-style: normal;
        font-weight: 500;
        line-height: var(--Line-Height-text-lg, 20px);
      }
    }
  }

  .referal-reward-overview {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
    flex: 4;

    @media (max-width: 1222px) {
      grid-template-columns: repeat(2, 1fr);
    }

    .referal-reward-overview-item {
      display: flex;
      padding: 16px;
      flex-direction: column;
      align-items: flex-start;
      gap: 6px;
      flex: 1 0 0;
      border-radius: 8px;
      background: rgba(0, 0, 0, 0.02);
      backdrop-filter: blur(5px);

      .title {
        display: flex;
        align-items: baseline;
        gap: 5px;

        .total {
          color: #000;
          font-family: Inter;
          font-size: 32px;
          font-style: normal;
          font-weight: 600;
          line-height: normal;
        }

        .increase {
          color: var(--Color-green-300, #1CC94D);
          font-family: Inter;
          font-size: 16px;
          font-style: normal;
          font-weight: 500;
          line-height: 20px;
        }
      }

      .desc {
        flex: 1;
        display: flex;
        align-items: end;
        gap: 4px;
        color: var(--Colors-Text-text-tertiary, #7C8387);
        font-family: Inter;
        font-size: 12px;
        font-style: normal;
        font-weight: 500;
        line-height: normal;
      }
    }
  }
}
</style>
